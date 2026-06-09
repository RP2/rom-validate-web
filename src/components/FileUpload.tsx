import { useState, useCallback, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  File,
  Upload,
  X,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { validateROMs, type ValidationResult } from "@/utils/romValidator";
import { getSupportedPlatforms } from "@/utils/datLoader";
import { getParallelWorkerCount } from "@/utils/validationSettings";
import ValidationProgress from "./ValidationProgress";
import { toast } from "sonner";

interface UploadedFile {
  file: File;
  id: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
  platform?: string;
  timeStarted?: number;
}

interface ValidationStats {
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  currentStage:
    | "initializing"
    | "hashing"
    | "loading-dats"
    | "validating"
    | "completed";
  timeStarted: number;
}

declare global {
  interface Window {
    validationResults?: ValidationResult[];
  }
}

export default function FileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("auto");
  const [supportedPlatforms, setSupportedPlatforms] = useState<string[]>([]);
  const [validationStats, setValidationStats] =
    useState<ValidationStats | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load supported platforms on component mount
  useEffect(() => {
    const platforms = getSupportedPlatforms();
    setSupportedPlatforms(platforms.sort());
  }, []);

  // Listen for clear progress event from results component
  useEffect(() => {
    const handleClearProgress = () => {
      setShowProgress(false);
      setValidationStats(null);
      setIsValidating(false);
      // Reset all file statuses to pending (full reset)
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "pending" as const,
          progress: 0,
          timeStarted: undefined,
        })),
      );
    };

    window.addEventListener("clearProgress", handleClearProgress);

    return () => {
      window.removeEventListener("clearProgress", handleClearProgress);
    };
  }, []);

  // Prevent default browser behavior for drag and drop
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Add event listeners to prevent default browser behavior
    document.addEventListener("dragover", preventDefaults);
    document.addEventListener("drop", handleGlobalDrop);

    return () => {
      document.removeEventListener("dragover", preventDefaults);
      document.removeEventListener("drop", handleGlobalDrop);
    };
  }, []);

  // Global drag event handlers to prevent browser default behavior
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    // Add global listeners to prevent browser from opening files
    document.addEventListener("dragover", handleGlobalDragOver);
    document.addEventListener("drop", handleGlobalDrop);

    return () => {
      document.removeEventListener("dragover", handleGlobalDragOver);
      document.removeEventListener("drop", handleGlobalDrop);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set drag over to false if we're actually leaving the drop zone
    // Check if the related target is outside the drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      // First, try to get files from the files property
      const droppedFiles = Array.from(e.dataTransfer.files);

      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
        return;
      }

      // If no files in .files, try to extract from DataTransferItems
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const itemFiles: File[] = [];

        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];

          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) {
              itemFiles.push(file);
            }
          }
        }

        if (itemFiles.length > 0) {
          addFiles(itemFiles);
          return;
        }
      }

      // Try to get text data to see what's being dropped
      for (const type of e.dataTransfer.types) {
        try {
          const data = e.dataTransfer.getData(type);

          // Handle file:// URLs (common when dragging from file managers)
          if (
            (type === "text/x-moz-url" ||
              type === "text/uri-list" ||
              type === "text/plain") &&
            data.startsWith("file://")
          ) {
            await handleFileUrl(data);
            return;
          }
        } catch (err) {
          // Silently continue to next data type
        }
      }
    } catch (error) {
      console.error("Error handling dropped files:", error);
    }
  }, []);

  // Helper function to handle file:// URLs
  const handleFileUrl = async (fileUrl: string) => {
    try {
      // Extract the file path from the URL and decode it
      const url = fileUrl.split("\n")[0]; // Handle x-moz-url format which includes title on second line
      const filePath = decodeURIComponent(url.replace("file://", ""));
      const fileName = filePath.split("/").pop() || "unknown-file";

      // For security reasons, browsers don't allow direct access to file:// URLs
      // Show a helpful message to the user
      toast.warning(`File detected: ${fileName}`, {
        description:
          'For security reasons, files dragged as URLs cannot be accessed directly. Please use the "Select Files" button instead.',
        duration: 8000,
      });
    } catch (error) {
      console.error("Error handling file URL:", error);
    }
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        addFiles(selectedFiles);
      }
    },
    [],
  );

  const handleDropZoneClick = useCallback(() => {
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    // Skip duplicates: same name + same size = likely the same file
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.file.name}|${f.file.size}`));
      const unique = newFiles.filter(
        (f) => !existing.has(`${f.name}|${f.size}`),
      );

      if (unique.length === 0) {
        toast.info("All files already added", {
          description: "Duplicate files are automatically skipped.",
        });
        return prev;
      }

      if (unique.length < newFiles.length) {
        toast.info(`${newFiles.length - unique.length} duplicate file(s) skipped`, {
          description: "Files with the same name and size are already in the queue.",
        });
      }

      const fileObjects: UploadedFile[] = unique.map((file) => ({
        file,
        id: crypto.randomUUID(),
        status: "pending",
        progress: 0,
      }));

      return [...prev, ...fileObjects];
    });

    // Scroll to file list after a short delay to ensure DOM is updated
    setTimeout(() => {
      const fileListElement = document.getElementById("file-list-section");
      if (fileListElement) {
        fileListElement.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }, 100);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const newFiles = prev.filter((f) => f.id !== id);
      // Only hide progress if no files remain AND validation is not completed
      if (newFiles.length === 0) {
        setShowProgress(false);
        setValidationStats(null);
        // Also clear results if no files remain
        if (window.validationResults) {
          delete window.validationResults;
        }
      } else {
        // Update validation stats to reflect the new file count
        setValidationStats((prevStats) => {
          if (prevStats) {
            const removedFile = prev.find((f) => f.id === id);
            const wasCompleted = removedFile?.status === "completed";

            return {
              ...prevStats,
              totalFiles: newFiles.length,
              processedFiles: wasCompleted
                ? Math.max(0, prevStats.processedFiles - 1)
                : prevStats.processedFiles,
            };
          }
          return prevStats;
        });
      }
      return newFiles;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const cancelValidation = () => {
    // Abort any in-progress validation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsValidating(false);
    setShowProgress(false);
    setValidationStats(null);
    // Reset only files that weren't completed yet
    setFiles((prev) =>
      prev.map((f) => {
        if (f.status === "completed") return f;
        return {
          ...f,
          status: "pending" as const,
          progress: 0,
          timeStarted: undefined,
        };
      }),
    );
  };

  const clearAllFiles = () => {
    setFiles([]);
    // If no files remain, also hide progress
    setShowProgress(false);
    setValidationStats(null);
  };

  const startValidation = async () => {
    // Only validate files that haven't been validated yet
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsValidating(true);
    setShowProgress(true);

    // Initialize validation stats for only the pending files
    const startTime = Date.now();
    setValidationStats({
      totalFiles: pendingFiles.length,
      processedFiles: 0,
      currentStage: "initializing",
      timeStarted: startTime,
    });

    try {
      // Process only pending files
      const fileList = pendingFiles.map((f) => f.file);

      // Map from file reference to its index in the pendingFiles array
      const fileIndexMap = new Map<File, number>();
      pendingFiles.forEach((f, i) => fileIndexMap.set(f.file, i));

      // Set stage to hashing
      setValidationStats((prev) =>
        prev ? { ...prev, currentStage: "hashing" } : null,
      );

      // Create abort controller for cancellation
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const results = await validateROMs(
        fileList,
        (current, total, currentFileName, stage, fileProgress = 0) => {
          // Only update the specific file being reported.
          // In parallel mode, files complete out of order, so we must NOT
          // infer completion of other files from index ordering.
          if (current >= 1) {
            const pendingIndex = current - 1;

            setFiles((prev) =>
              prev.map((f) => {
                const pIdx = fileIndexMap.get(f.file);
                if (pIdx !== pendingIndex) return f; // Not this file — skip

                // Mark as completed if progress is 100, otherwise processing
                const newStatus = fileProgress >= 100
                  ? ("completed" as const)
                  : ("processing" as const);

                return {
                  ...f,
                  status: newStatus,
                  progress: fileProgress,
                  timeStarted: f.timeStarted || Date.now(),
                };
              }),
            );
          }
        },
        selectedPlatform !== "auto" ? selectedPlatform : undefined,
        getParallelWorkerCount(),
        abortController.signal,
      );

      // Mark all pending files as completed
      abortControllerRef.current = null;

      setFiles((prev) =>
        prev.map((f) => {
          if (f.status === "pending" || f.status === "processing") {
            return { ...f, status: "completed" as const, progress: 100 };
          }
          return f;
        }),
      );

      // Update final stats
      setValidationStats((prev) =>
        prev
          ? {
              ...prev,
              processedFiles: pendingFiles.length,
              currentStage: "completed",
              currentFile: undefined,
            }
          : null,
      );

      // Accumulate results: append to any existing results so adding more files works
      window.validationResults = [
        ...(window.validationResults || []),
        ...results,
      ];

      // Dispatch event so ValidationResults picks up the new data
      window.dispatchEvent(new CustomEvent("validationResultsUpdated"));

      // Show results section but keep progress visible
      setTimeout(() => {
        setIsValidating(false); // Stop validation but keep progress visible
        const resultsSection = document.getElementById("results-section");
        if (resultsSection) {
          resultsSection.classList.remove("hidden");
          resultsSection.scrollIntoView({ behavior: "smooth" });
        }
      }, 500);
    } catch (error) {
      abortControllerRef.current = null;

      // If cancelled, don't show an error — just reset
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Validation error:", error);
      setIsValidating(false);
      setShowProgress(false);
      setValidationStats(null);

      // Check for out of memory error
      const isOutOfMemory =
        error instanceof Error &&
        (error.name === "OutOfMemoryError" ||
          error.message.includes("allocation") ||
          error.message.includes("memory") ||
          error.message.includes("out of memory"));

      if (isOutOfMemory) {
        toast.error("Out of Memory", {
          description:
            "The browser ran out of memory while processing your files. Please try again with fewer files at a time, or process large files individually.",
          duration: 10000,
        });
      }

      // Show more detailed error information
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Mark only pending/processing files with errors (don't touch already-completed ones)
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status === "pending" || f.status === "processing") {
            return {
              ...f,
              status: "error" as const,
              error: isOutOfMemory
                ? "Out of memory - please retry with fewer files"
                : `Validation failed: ${errorMessage}`,
            };
          }
          return f;
        }),
      );
    }
  };

  // Check if any files are larger than 1GB
  const hasLargeFiles = files.some((f) => f.file.size > 1024 * 1024 * 1024);

  return (
    <div className="space-y-6">
      {/* Large File Warning */}
      {hasLargeFiles && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-500 [&>svg]:text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Large Files Detected</AlertTitle>
          <AlertDescription>
            Files larger than 1GB (like PS2 ISOs) will take longer to process.
            Processing continues in the background and you can monitor progress
            below. For best results with very large files, process fewer files
            at a time.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Area */}
      <div
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        style={{ pointerEvents: isDragOver ? "none" : "auto" }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleDropZoneClick}
        role="button"
        tabIndex={0}
        aria-label="Drop ROM files here or click to select"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleDropZoneClick();
          }
        }}
      >
        <div style={{ pointerEvents: "none" }}>
          <Upload
            className={`mx-auto mb-4 h-12 w-12 transition-colors ${
              isDragOver ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <h3
            className={`mb-2 text-lg font-semibold transition-colors ${
              isDragOver ? "text-primary" : "text-foreground"
            }`}
          >
            {isDragOver ? "Drop files here!" : files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""} ready to validate` : "Drop ROM files here"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {files.length > 0 ? "Add more files or click Validate below" : "or click to browse your files"}
          </p>
          <Button
            variant="outline"
            className="mb-2"
            style={{ pointerEvents: "auto" }}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".bin,.cue,.iso,.nds,.3ds,.gba,.gb,.gbc,.smc,.sfc,.nes,.n64,.z64,.gen,.md,.32x,.gg,.ms,.pce,.tg16,.lynx,.ngp,.ngc,.ws,.wsc,.a26,.a52,.a78,.col,.int,.vectrex"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            Select Files
          </Button>
          <p className="text-muted-foreground text-xs">
            Supports: BIN, ISO, NDS, 3DS, GBA, GB, GBC, N64, SNES, NES and other
            popular game file formats
          </p>
        </div>
      </div>

      {/* Platform Selection (Optional) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Platform Selection (Optional)
          </CardTitle>
          <CardDescription>
            Choose a specific platform for faster validation, or leave on "Auto"
            for intelligent detection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="platform-select" className="text-sm font-medium">
                Target Platform
              </label>
              <Select
                value={selectedPlatform}
                onValueChange={setSelectedPlatform}
              >
                <SelectTrigger id="platform-select">
                  <SelectValue>
                    {selectedPlatform === "auto"
                      ? "Auto-detect (recommended)"
                      : selectedPlatform}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Auto-detect (recommended)
                  </SelectItem>
                  {supportedPlatforms.length > 0 &&
                    supportedPlatforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="mb-2 font-medium">How it works:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>
                  <strong>Auto-detect:</strong> Uses file extension, size, and
                  filename hints to determine the most likely platform(s) and
                  validates in smart order
                </li>
                <li>
                  <strong>Manual selection:</strong> Tries the chosen platform
                  first for maximum speed, then falls back to auto-detection if
                  no match is found
                </li>
              </ul>
              {selectedPlatform !== "auto" && (
                <div className="border-muted mt-2 border-t pt-2">
                  <p className="text-foreground">
                    <strong>Selected:</strong> {selectedPlatform}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Will try this platform first, then auto-detect if no matches
                    are found
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card id="file-list-section">
          <CardHeader>
            <CardTitle>Selected Files ({files.length})</CardTitle>
            <CardDescription>
              Review your ROM files before validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 overflow-hidden">
              {files.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="border-border flex items-center gap-3 rounded-md border p-3"
                >
                  <File className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatFileSize(uploadedFile.file.size)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {uploadedFile.file.name.split(".").pop()?.toUpperCase()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadedFile.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={startValidation}
                disabled={isValidating || files.filter((f) => f.status === "pending").length === 0}
                className="flex-1"
              >
                {isValidating ? (
                  <>
                    <div className="border-primary-foreground mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                    Validating...
                  </>
                ) : files.some((f) => f.status === "completed") ? (
                  "Validate New Files"
                ) : (
                  "Start Validation"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={clearAllFiles}
                disabled={isValidating}
              >
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Validation Progress */}
      {showProgress && validationStats && (
        <ValidationProgress
          files={files.map((f) => ({
            id: f.id,
            name: f.file.name,
            status:
              f.status === "processing"
                ? f.progress < 90
                  ? "hashing"
                  : "validating"
                : f.status === "completed"
                  ? "completed"
                  : f.status === "error"
                    ? "error"
                    : "pending",
            progress: f.progress,
            size: f.file.size,
            platform: f.platform,
            timeStarted: f.timeStarted,
          }))}
          stats={validationStats}
          onCancel={cancelValidation}
        />
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>DAT Sources:</strong> This validator uses encrypted Nintendo
          DS DATs (bundled locally) and dynamically fetches No-Intro and Redump
          DATs from Libretro's repository for other platforms.
          <strong>Privacy:</strong> Files are always processed locally, they are
          never sent anywhere.
        </AlertDescription>
      </Alert>
    </div>
  );
}
