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
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
  RotateCcw,
  FileText,
  HardDrive,
  Hash,
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
          <div className="mb-6 flex flex-wrap gap-3">
            <div className="flex gap-2">
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
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {filteredResults.map((result, index) => (
              <div
                key={`${result.filename}-${index}`}
                className="border-border rounded-lg border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-1 items-start space-x-3">
                    {getStatusIcon(result.status)}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h4 className="text-foreground truncate font-medium">
                          {result.filename}
                        </h4>
                        {getStatusBadge(result.status)}
                      </div>

                      {result.originalName !== result.filename && (
                        <p className="text-muted-foreground mb-1 text-sm">
                          Original: {result.originalName}
                        </p>
                      )}

                      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                        {result.platform && (
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {result.platform}
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

                  <div className="ml-4 flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Hash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="border-border mt-6 flex gap-3 border-t pt-6">
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
            <Button variant="outline" onClick={handleApplyRenames}>
              Apply Renames (Downloads {filesToRename.length} Files)
            </Button>
            <Button variant="outline">Export Unknown List</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
