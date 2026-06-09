import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Hash,
  Database,
  CheckCircle2,
  Timer,
  Files,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update elapsed time once per second — avoids re-renders on every progress tick
  const startTimeRef = useRef(stats.timeStarted);
  useEffect(() => {
    startTimeRef.current = stats.timeStarted;
    setElapsedSeconds(Math.floor((Date.now() - stats.timeStarted) / 1000));

    if (stats.currentStage === "completed") return;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [stats.timeStarted, stats.currentStage]);

  // Derive stable counts from the files array
  const completedCount = useMemo(
    () => files.filter((f) => f.status === "completed").length,
    [files],
  );
  const errorCount = useMemo(
    () => files.filter((f) => f.status === "error").length,
    [files],
  );
  const processingCount = useMemo(
    () =>
      files.filter(
        (f) => f.status === "hashing" || f.status === "validating" || f.status === "processing",
      ).length,
    [files],
  );
  const pendingCount = useMemo(
    () => files.filter((f) => f.status === "pending").length,
    [files],
  );

  // Calculate overall progress from all files, not just one
  const overallProgress = useMemo(() => {
    if (files.length === 0) return 0;

    // Each file contributes: completed=100%, processing=its progress%, pending=0%
    const totalProgress = files.reduce((sum, f) => {
      if (f.status === "completed" || f.status === "error") return sum + 100;
      if (f.status === "hashing" || f.status === "validating" || f.status === "processing")
        return sum + f.progress;
      return sum;
    }, 0);

    return Math.min(totalProgress / files.length, 100);
  }, [files]);

  // Calculate time remaining based on completed files
  const timeElapsedMs = elapsedSeconds * 1000;
  const avgTimePerFile =
    completedCount > 0 ? timeElapsedMs / completedCount : 0;
  const remainingFiles = files.length - completedCount - errorCount;
  const estimatedTimeRemainingMs =
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
              {completedCount} of {files.length} files processed
            </span>
            <span className="text-muted-foreground">
              {Math.round(overallProgress)}%
            </span>
          </div>

          <Progress value={overallProgress} className="h-2" />

          {/* Time information */}
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              <span>Elapsed: {formatTime(timeElapsedMs)}</span>
            </div>
            {estimatedTimeRemainingMs && stats.currentStage !== "completed" && (
              <span>Est. remaining: {formatTime(estimatedTimeRemainingMs)}</span>
            )}
          </div>
        </div>

        {/* Batch status summary — shows how many files are in each state */}
        {stats.currentStage !== "completed" && (
          <div className="bg-muted/50 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {processingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
                  <span>
                    {processingCount} processing
                  </span>
                </div>
              )}
              {completedCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  <span>
                    {completedCount} done
                  </span>
                </div>
              )}
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="text-muted-foreground h-3.5 w-3.5" />
                  <span>
                    {pendingCount} queued
                  </span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <span>
                    {errorCount} error{errorCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
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

                    <div className="flex shrink-0 items-center gap-2">
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