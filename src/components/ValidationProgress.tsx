import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  File,
  Hash,
  Database,
  CheckCircle2,
  Timer,
  Files,
} from "lucide-react";
import { useState, useEffect } from "react";

interface FileProgress {
  id: string;
  name: string;
  status: "pending" | "hashing" | "validating" | "completed" | "error";
  progress: number;
  size: number;
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
  estimatedTimeRemaining?: number;
  averageFileTime?: number;
}

interface ValidationProgressProps {
  files: FileProgress[];
  stats: ValidationStats;
  onCancel?: () => void;
}

export default function ValidationProgress({
  files,
  stats,
  onCancel,
}: ValidationProgressProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate overall progress with more granular steps
  const overallProgress =
    files.length > 0
      ? (() => {
          const filesCompleted = files.filter(
            (f) => f.status === "completed",
          ).length;
          const currentFileProgress =
            files.find(
              (f) => f.status === "hashing" || f.status === "validating",
            )?.progress || 0;
          const baseProgress = (filesCompleted / files.length) * 100;
          const currentProgress =
            (currentFileProgress / 100) * (1 / files.length) * 100;
          return Math.min(baseProgress + currentProgress, 100);
        })()
      : 0;

  // Calculate time remaining
  const timeElapsed = Date.now() - stats.timeStarted;
  const avgTimePerFile =
    stats.processedFiles > 0 ? timeElapsed / stats.processedFiles : 0;
  const remainingFiles = files.length - stats.processedFiles;
  const estimatedTimeRemaining =
    remainingFiles > 0 && avgTimePerFile > 0
      ? remainingFiles * avgTimePerFile
      : undefined;

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStageInfo = (stage: ValidationStats["currentStage"]) => {
    switch (stage) {
      case "initializing":
        return {
          icon: <Files className="h-4 w-4" />,
          label: "Initializing",
          color: "text-blue-600",
        };
      case "hashing":
        return {
          icon: <Hash className="h-4 w-4" />,
          label: "Calculating hashes",
          color: "text-purple-600",
        };
      case "loading-dats":
        return {
          icon: <Database className="h-4 w-4" />,
          label: "Loading DAT files",
          color: "text-amber-600",
        };
      case "validating":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: "Validating",
          color: "text-emerald-600",
        };
      case "completed":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          label: "Completed",
          color: "text-green-600",
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          label: "Processing",
          color: "text-muted-foreground",
        };
    }
  };

  const getFileStatusIcon = (status: FileProgress["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "hashing":
        return <Hash className="h-4 w-4 text-purple-600" />;
      case "validating":
        return <Database className="h-4 w-4 text-blue-600" />;
      case "error":
        return <AlertCircle className="text-destructive h-4 w-4" />;
      default:
        return <Clock className="text-muted-foreground h-4 w-4" />;
    }
  };

  const stageInfo = getStageInfo(stats.currentStage);

  if (!mounted) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: stats.currentStage !== "completed" ? 360 : 0 }}
              transition={{
                duration: 2,
                repeat: stats.currentStage !== "completed" ? Infinity : 0,
                ease: "linear",
              }}
            >
              {stageInfo.icon}
            </motion.div>
            Validation Progress
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={stageInfo.color}>
              {stageInfo.label}
            </Badge>
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {stats.currentStage === "completed" ? "Dismiss" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {stats.processedFiles} of {files.length} files processed
            </span>
            <span className="text-muted-foreground">
              {Math.round(overallProgress)}%
            </span>
          </div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Progress value={overallProgress} className="h-2" />
          </motion.div>

          {/* Time information */}
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              <span>Elapsed: {formatTime(timeElapsed)}</span>
            </div>
            {estimatedTimeRemaining && stats.currentStage !== "completed" && (
              <span>Est. remaining: {formatTime(estimatedTimeRemaining)}</span>
            )}
          </div>
        </div>

        {/* Current file being processed */}
        {stats.currentFile && stats.currentStage !== "completed" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 rounded-lg border p-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="text-primary h-4 w-4 animate-spin" />
              <span className="font-medium">Processing:</span>
              <span className="text-muted-foreground truncate font-mono">
                {stats.currentFile}
              </span>
            </div>
          </motion.div>
        )}

        {/* File list with individual progress */}
        {files.length > 0 && files.length <= 10 && (
          <div className="space-y-2">
            <h4 className="text-muted-foreground text-sm font-medium">
              File Details
            </h4>
            <div className="max-h-48 space-y-1 overflow-x-hidden overflow-y-auto">
              <AnimatePresence>
                {files.map((file, index) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between gap-3 rounded-md p-2 text-xs ${
                      file.status === "completed"
                        ? "border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                        : file.status === "error"
                          ? "border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                          : file.status !== "pending"
                            ? "bg-primary/10 border-primary/20 border"
                            : "bg-muted border-border border"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {getFileStatusIcon(file.status)}
                      <span className="truncate font-mono">{file.name}</span>
                      {file.platform && (
                        <Badge variant="outline" className="px-1 py-0 text-xs">
                          {file.platform}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                      {file.status !== "pending" &&
                        file.status !== "completed" && (
                          <div className="w-12">
                            <Progress value={file.progress} className="h-1" />
                          </div>
                        )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Summary for many files */}
        {files.length > 10 && (
          <div className="bg-muted/50 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total size:</span>
                <span className="ml-2 font-medium">
                  {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Platforms detected:
                </span>
                <span className="ml-2 font-medium">
                  {
                    new Set(
                      files.filter((f) => f.platform).map((f) => f.platform),
                    ).size
                  }
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
