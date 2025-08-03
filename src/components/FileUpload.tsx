import { useState, useCallback, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  File,
  Upload,
  X,
  Settings,
} from "lucide-react";
import { validateROMs, type ValidationResult } from "@/utils/romValidator";
import { getSupportedPlatforms } from "@/utils/datLoader";
import ValidationProgress from "./ValidationProgress";

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
      // Reset file statuses to pending but keep the files
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
      alert(
        `File detected: ${fileName}\n\nFor security reasons, files dragged as URLs cannot be accessed directly. Please use the "Select Files" button instead.`,
      );
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
    const fileObjects: UploadedFile[] = newFiles.map((file) => ({
      file,
      id: crypto.randomUUID(),
      status: "pending",
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...fileObjects]);

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
    setIsValidating(false);
    setShowProgress(false);
    setValidationStats(null);
    // Reset file statuses but keep the files
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        status: "pending" as const,
        progress: 0,
        timeStarted: undefined,
      })),
    );
  };

  const clearAllFiles = () => {
    setFiles([]);
    // If no files remain, also hide progress
    setShowProgress(false);
    setValidationStats(null);
  };

  const startValidation = async () => {
    if (files.length === 0) return;

    setIsValidating(true);
    setShowProgress(true);

    // Initialize validation stats
    const startTime = Date.now();
    setValidationStats({
      totalFiles: files.length,
      processedFiles: 0,
      currentStage: "initializing",
      timeStarted: startTime,
    });

    try {
      // Process files locally using the ROM validator
      const fileList = files.map((f) => f.file);

      // Set stage to hashing
      setValidationStats((prev) =>
        prev ? { ...prev, currentStage: "hashing" } : null,
      );

      const results = await validateROMs(
        fileList,
        (current, total, currentFileName, stage, fileProgress = 0) => {
          // Update progress for the current file being processed
          const currentIndex = files.findIndex(
            (f) => f.file.name === currentFileName,
          );

          // Update validation stats
          setValidationStats((prev) =>
            prev
              ? {
                  ...prev,
                  processedFiles: current - 1,
                  currentFile: currentFileName,
                  currentStage: stage,
                }
              : null,
          );

          setFiles((prev) =>
            prev.map((f, index) => {
              if (index === currentIndex) {
                const status =
                  stage === "hashing"
                    ? "processing"
                    : stage === "loading-dats"
                      ? "processing"
                      : stage === "validating"
                        ? "processing"
                        : "processing";

                return {
                  ...f,
                  status,
                  progress: fileProgress,
                  timeStarted: f.timeStarted || Date.now(),
                };
              } else if (index < currentIndex) {
                return { ...f, status: "completed", progress: 100 };
              }
              return f;
            }),
          );
        },
        selectedPlatform !== "auto" ? selectedPlatform : undefined, // Pass selected platform if chosen
      );

      // Mark all files as completed
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "completed", progress: 100 })),
      );

      // Update final stats
      setValidationStats((prev) =>
        prev
          ? {
              ...prev,
              processedFiles: files.length,
              currentStage: "completed",
              currentFile: undefined,
            }
          : null,
      );

      // Store results globally for the results component to access
      window.validationResults = results;

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
      console.error("Validation error:", error);
      setIsValidating(false);
      setShowProgress(false);
      setValidationStats(null);

      // Show more detailed error information
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Mark files with errors
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error",
          error: `Validation failed: ${errorMessage}`,
        })),
      );
    }
  };

  return (
    <div className="space-y-6">
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
            {isDragOver ? "Drop files here!" : "Drop ROM files here"}
          </h3>
          <p className="text-muted-foreground mb-4">
            or click to browse your files
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
                  <File className="text-muted-foreground h-5 w-5 flex-shrink-0" />
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
                disabled={isValidating}
                className="flex-1"
              >
                {isValidating ? (
                  <>
                    <div className="border-primary-foreground mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                    Validating...
                  </>
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
                ? validationStats?.currentStage === "hashing"
                  ? "hashing"
                  : validationStats?.currentStage === "loading-dats"
                    ? "validating"
                    : validationStats?.currentStage === "validating"
                      ? "validating"
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
