import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
  RotateCcw,
  FileText,
  HardDrive,
  Hash,
  Copy,
  Calendar,
  Info,
} from "lucide-react";
import type { ValidationResult } from "@/utils/romValidator";

interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  unknown: number;
  renamed: number;
  platforms: string[];
  processingTime: number;
}

declare global {
  interface Window {
    validationResults?: ValidationResult[];
  }
}

export default function ValidationResults() {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Load results from global state
  useEffect(() => {
    const loadResults = () => {
      if (window.validationResults) {
        const validationResults = window.validationResults;
        setResults(validationResults);

        // Calculate summary
        const platforms = [
          ...new Set(validationResults.map((r) => r.platform).filter(Boolean)),
        ];
        const summary: ValidationSummary = {
          total: validationResults.length,
          valid: validationResults.filter((r) => r.status === "valid").length,
          invalid: validationResults.filter((r) => r.status === "invalid")
            .length,
          unknown: validationResults.filter((r) => r.status === "unknown")
            .length,
          renamed: validationResults.filter((r) => r.status === "renamed")
            .length,
          platforms: platforms as string[],
          processingTime: 0, // Would be calculated in real implementation
        };
        setSummary(summary);
      }
    };

    // Load immediately if data is already available
    loadResults();

    // Poll for updates (in case validation is still running)
    const interval = setInterval(loadResults, 1000);

    return () => clearInterval(interval);
  }, []);

  const filteredResults = results.filter((result) => {
    const platformMatch =
      selectedPlatform === "all" || result.platform === selectedPlatform;
    const statusMatch =
      selectedStatus === "all" || result.status === selectedStatus;
    return platformMatch && statusMatch;
  });

  const filesToRename = results.filter(
    (result) =>
      result.status === "renamed" && result.suggestedName && result.file,
  );

  const unknownFiles = results.filter((result) => result.status === "unknown");

  const handleApplyRenames = async () => {
    if (filesToRename.length === 0) {
      alert("No files need renaming.");
      return;
    }

    try {
      for (const result of filesToRename) {
        if (result.file && result.suggestedName) {
          // Create a new File object with the suggested name
          const renamedFile = new File([result.file], result.suggestedName, {
            type: result.file.type,
            lastModified: result.file.lastModified,
          });

          // Trigger download
          const url = URL.createObjectURL(renamedFile);
          const link = document.createElement("a");
          link.href = url;
          link.download = result.suggestedName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          // Small delay between downloads to avoid browser blocking
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      alert(
        `Successfully initiated downloads for ${filesToRename.length} renamed files.`,
      );
    } catch (error) {
      console.error("Error downloading renamed files:", error);
      alert("Error downloading renamed files. Please try again.");
    }
  };

  const handleDownloadReport = () => {
    if (!summary || results.length === 0) {
      alert("No validation results to export.");
      return;
    }

    try {
      // Generate comprehensive report
      const reportLines = [
        "ROM Validation Report",
        "===================",
        "",
        `Generated: ${new Date().toLocaleString()}`,
        `Total Files Processed: ${summary.total}`,
        "",
        "Summary:",
        `- Valid: ${summary.valid}`,
        `- Invalid: ${summary.invalid}`,
        `- Unknown: ${summary.unknown}`,
        `- Renamed: ${summary.renamed}`,
        "",
        `Platforms Detected: ${summary.platforms.join(", ")}`,
        "",
        "Detailed Results:",
        "================",
        "",
      ];

      // Add detailed results for each file
      results.forEach((result, index) => {
        reportLines.push(`${index + 1}. ${result.filename}`);
        reportLines.push(`   Status: ${result.status.toUpperCase()}`);
        reportLines.push(
          `   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`,
        );

        if (result.platform) {
          reportLines.push(`   Platform: ${result.platform}`);
        }

        if (result.region) {
          reportLines.push(`   Region: ${result.region}`);
        }

        reportLines.push(`   Hashes:`);
        reportLines.push(`     CRC32: ${result.hashes.crc32}`);
        reportLines.push(`     MD5: ${result.hashes.md5}`);
        reportLines.push(`     SHA1: ${result.hashes.sha1}`);

        if (result.matchedEntry) {
          reportLines.push(`   Matched ROM: ${result.matchedEntry.name}`);
        }

        if (result.suggestedName) {
          reportLines.push(`   Suggested Name: ${result.suggestedName}`);
        }

        if (result.issues && result.issues.length > 0) {
          reportLines.push(`   Issues:`);
          result.issues.forEach((issue) => {
            reportLines.push(`     - ${issue}`);
          });
        }

        reportLines.push("");
      });

      // Add summary of actions needed
      reportLines.push("Actions Required:");
      reportLines.push("================");

      if (summary.renamed > 0) {
        reportLines.push(
          `- ${summary.renamed} files need renaming for proper organization`,
        );
      }

      if (summary.unknown > 0) {
        reportLines.push(
          `- ${summary.unknown} files could not be identified and may need manual review`,
        );
      }

      if (summary.invalid > 0) {
        reportLines.push(`- ${summary.invalid} files have validation issues`);
      }

      if (summary.valid === summary.total) {
        reportLines.push("- All files are properly validated! ✓");
      }

      // Create and download the report
      const reportContent = reportLines.join("\n");
      const blob = new Blob([reportContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `rom-validation-report-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Error generating report. Please try again.");
    }
  };

  const handleExportUnknownList = () => {
    if (unknownFiles.length === 0) {
      alert("No unknown files to export.");
      return;
    }

    try {
      const reportLines = [
        "Unknown ROM Files List",
        "=====================",
        "",
        `Generated: ${new Date().toLocaleString()}`,
        `Total Unknown Files: ${unknownFiles.length}`,
        "",
        "Files that could not be identified:",
        "===================================",
        "",
      ];

      unknownFiles.forEach((result, index) => {
        reportLines.push(`${index + 1}. ${result.filename}`);
        reportLines.push(
          `   Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`,
        );

        if (result.platform) {
          reportLines.push(`   Detected Platform: ${result.platform}`);
        }

        if (result.region) {
          reportLines.push(`   Detected Region: ${result.region}`);
        }

        reportLines.push(`   CRC32: ${result.hashes.crc32}`);
        reportLines.push(`   MD5: ${result.hashes.md5}`);
        reportLines.push(`   SHA1: ${result.hashes.sha1}`);

        if (result.issues && result.issues.length > 0) {
          reportLines.push(`   Notes:`);
          result.issues.forEach((issue) => {
            reportLines.push(`     - ${issue}`);
          });
        }

        reportLines.push("");
      });

      reportLines.push("Recommendations:");
      reportLines.push("===============");
      reportLines.push(
        "- Check if these are ROM hacks, translations, or homebrew games",
      );
      reportLines.push("- Verify file integrity and source");
      reportLines.push("- Search online databases using the provided hashes");
      reportLines.push("- Consider if files need different DAT sources");

      const reportContent = reportLines.join("\n");
      const blob = new Blob([reportContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `unknown-roms-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting unknown list:", error);
      alert("Error exporting unknown list. Please try again.");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "invalid":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "unknown":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "renamed":
        return <RotateCcw className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      valid: "default",
      invalid: "destructive",
      unknown: "secondary",
      renamed: "outline",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if you have one
      console.log("Copied to clipboard:", text);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDATSourceURL = (datSource: string) => {
    switch (datSource?.toLowerCase()) {
      case "no-intro":
        return "https://datomatic.no-intro.org/";
      case "redump":
        return "http://redump.org/";
      default:
        return null;
    }
  };

  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-foreground text-2xl font-bold">
                  {summary.total}
                </p>
                <p className="text-muted-foreground text-xs">Total Files</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {summary.valid}
                </p>
                <p className="text-muted-foreground text-xs">Valid</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {summary.unknown}
                </p>
                <p className="text-muted-foreground text-xs">Unknown</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <RotateCcw className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {summary.renamed}
                </p>
                <p className="text-muted-foreground text-xs">Renamed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Results */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Results</CardTitle>
          <CardDescription>
            Processed in {summary.processingTime}s • {summary.platforms.length}{" "}
            platforms detected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={selectedStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("all")}
            >
              All Status
            </Button>
            <Button
              variant={selectedStatus === "valid" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("valid")}
            >
              Valid
            </Button>
            <Button
              variant={selectedStatus === "unknown" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("unknown")}
            >
              Unknown
            </Button>
            <Button
              variant={selectedStatus === "renamed" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus("renamed")}
            >
              Renamed
            </Button>
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {filteredResults.map((result, index) => (
              <div
                key={`${result.filename}-${index}`}
                className="border-border rounded-lg border p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start space-x-3">
                    <div className="shrink-0">
                      {getStatusIcon(result.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <h4 className="text-foreground min-w-0 truncate font-medium">
                          {result.filename}
                        </h4>
                        <div className="shrink-0">
                          {getStatusBadge(result.status)}
                        </div>
                      </div>

                      {result.originalName !== result.filename && (
                        <p className="text-muted-foreground mb-1 text-sm break-words">
                          Original: {result.originalName}
                        </p>
                      )}

                      <div className="text-muted-foreground flex flex-wrap gap-2 text-xs sm:gap-4">
                        {result.platform && result.platform !== "unknown" && (
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            <span className="break-words">
                              {result.platform}
                            </span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {formatFileSize(result.size)}
                        </span>
                        {result.region && (
                          <Badge variant="outline" className="text-xs">
                            {result.region}
                          </Badge>
                        )}
                      </div>

                      {result.issues && result.issues.length > 0 && (
                        <Alert className="mt-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <ul className="space-y-1 text-sm">
                              {result.issues.map((issue, idx) => (
                                <li key={idx}>• {issue}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.suggestedName && (
                        <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-950/20">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Suggested rename:</strong>{" "}
                            {result.suggestedName}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:ml-4 sm:flex-row">
                    {/* File Details Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="border-border flex w-full items-center gap-2 border sm:w-auto sm:border-0 sm:px-2"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sm:hidden">Details</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            File Details
                          </DialogTitle>
                          <DialogDescription className="break-words">
                            Detailed information about {result.filename}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Basic File Info */}
                          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div className="space-y-4">
                              <h4 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                                File Information
                              </h4>
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <span className="text-muted-foreground text-sm">
                                    Filename
                                  </span>
                                  <p className="bg-muted rounded px-2 py-1 font-mono text-sm break-all">
                                    {result.filename}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-muted-foreground text-sm">
                                    Size
                                  </span>
                                  <span className="text-sm font-medium">
                                    {formatFileSize(result.size)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <span className="text-muted-foreground text-sm">
                                    Status
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(result.status)}
                                    {getStatusBadge(result.status)}
                                  </div>
                                </div>
                                {result.file && (
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground text-sm">
                                      Modified
                                    </span>
                                    <p className="text-sm">
                                      {formatDate(result.file.lastModified)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                                Platform Information
                              </h4>
                              <div className="space-y-3">
                                {result.platform && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <span className="text-muted-foreground text-sm">
                                      Platform
                                    </span>
                                    <span className="text-sm font-medium">
                                      {result.platform}
                                    </span>
                                  </div>
                                )}
                                {result.region && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <span className="text-muted-foreground text-sm">
                                      Region
                                    </span>
                                    <div>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {result.region}
                                      </Badge>
                                    </div>
                                  </div>
                                )}
                                {result.matchedEntry && (
                                  <>
                                    <div className="space-y-1">
                                      <span className="text-muted-foreground text-sm">
                                        Matched ROM
                                      </span>
                                      <p className="bg-muted rounded px-2 py-1 font-mono text-xs break-all">
                                        {result.matchedEntry.name}
                                      </p>
                                    </div>
                                    {result.datSource && (
                                      <div className="grid grid-cols-2 gap-2">
                                        <span className="text-muted-foreground text-sm">
                                          DAT Source
                                        </span>
                                        <div>
                                          {getDATSourceURL(result.datSource) ? (
                                            <a
                                              href={
                                                getDATSourceURL(
                                                  result.datSource,
                                                )!
                                              }
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-block"
                                            >
                                              <Badge
                                                variant="secondary"
                                                className="hover:bg-secondary/80 cursor-pointer text-xs transition-colors"
                                              >
                                                {result.datSource}
                                              </Badge>
                                            </a>
                                          ) : (
                                            <Badge
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {result.datSource}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                                {!result.platform &&
                                  !result.region &&
                                  !result.matchedEntry && (
                                    <p className="text-muted-foreground text-sm italic">
                                      No platform information available
                                    </p>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Suggested Name */}
                          {result.suggestedName && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
                              <div className="mb-3 flex items-center gap-2">
                                <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                                  Suggested Rename
                                </h4>
                              </div>
                              <code className="rounded bg-white/50 px-2 py-1 text-sm break-all dark:bg-black/20">
                                {result.suggestedName}
                              </code>
                            </div>
                          )}

                          {/* Issues */}
                          {result.issues && result.issues.length > 0 && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
                              <div className="mb-3 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                <h4 className="font-semibold text-red-800 dark:text-red-200">
                                  Issues Found
                                </h4>
                              </div>
                              <ul className="space-y-2">
                                {result.issues.map((issue, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-2 text-sm"
                                  >
                                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                                    <span className="text-red-700 dark:text-red-300">
                                      {issue}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Hash Information Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="border-border flex w-full items-center gap-2 border sm:w-auto sm:border-0 sm:px-2"
                        >
                          <Hash className="h-4 w-4" />
                          <span className="sm:hidden">Hashes</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Hash className="h-5 w-5" />
                            File Hashes
                          </DialogTitle>
                          <DialogDescription className="break-words">
                            Calculated hashes for {result.filename}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {/* CRC32 */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">CRC32</label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <code className="bg-muted min-w-0 flex-1 rounded px-3 py-2 font-mono text-sm break-all">
                                {result.hashes.crc32}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(result.hashes.crc32)
                                }
                                className="shrink-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* MD5 */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">MD5</label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <code className="bg-muted min-w-0 flex-1 rounded px-3 py-2 font-mono text-sm break-all">
                                {result.hashes.md5}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(result.hashes.md5)
                                }
                                className="shrink-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* SHA1 */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">SHA1</label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <code className="bg-muted min-w-0 flex-1 rounded px-3 py-2 font-mono text-sm break-all">
                                {result.hashes.sha1}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(result.hashes.sha1)
                                }
                                className="shrink-0"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <div className="text-muted-foreground pt-2 text-xs">
                            Click the copy buttons to copy individual hashes to
                            clipboard
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="border-border mt-6 flex gap-3 border-t pt-6">
            <Button onClick={handleDownloadReport}>
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
            {filesToRename.length > 0 && (
              <Button variant="outline" onClick={handleApplyRenames}>
                Apply Renames (Download {filesToRename.length} Files)
              </Button>
            )}
            {unknownFiles.length > 0 && (
              <Button variant="outline" onClick={handleExportUnknownList}>
                Export Unknown List ({unknownFiles.length} Files)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
