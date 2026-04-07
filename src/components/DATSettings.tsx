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
import {
  HardDrive,
  AlertTriangle,
  Database,
  Trash2,
  Upload,
  ExternalLink,
} from "lucide-react";
import {
  getCachedDATs,
  clearDATCache,
  uploadCustomDAT,
  getRawDATContent,
} from "@/utils/datLoader";
import { toast } from "sonner";

interface CachedDAT {
  platform: string;
  source: string;
  entryCount: number;
}

export default function DATSettings() {
  const [cachedDATs, setCachedDATs] = useState<CachedDAT[]>([]);
  const [loadingDATs, setLoadingDATs] = useState(true);

  useEffect(() => {
    loadCachedDATs();
  }, []);

  const loadCachedDATs = async () => {
    setLoadingDATs(true);
    try {
      const dats = await getCachedDATs();
      setCachedDATs(dats);
    } catch (error) {
      console.error("Failed to load cached DATs:", error);
    } finally {
      setLoadingDATs(false);
    }
  };

  const handleClearCache = () => {
    clearDATCache();
    loadCachedDATs();
    toast.success("DAT cache cleared successfully!");
  };

  const handleBrowseDAT = async (platform: string, source: string) => {
    try {
      const rawContent = await getRawDATContent(platform, source);

      if (rawContent) {
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>DAT Browser - ${platform} (${source})</title>
  <style>
    body { 
      font-family: 'Courier New', monospace; 
      background: #1e1e1e; 
      color: #d4d4d4; 
      margin: 20px; 
      line-height: 1.4;
    }
    .header { 
      background: #2d2d30; 
      padding: 15px; 
      border-radius: 5px; 
      margin-bottom: 20px;
      border-left: 4px solid #007acc;
    }
    .content { 
      white-space: pre-wrap; 
      font-size: 12px;
      background: #252526;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    .tip {
      background: #3c3c3c;
      color: #cccccc;
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 15px;
      font-size: 11px;
      border-left: 3px solid #007acc;
    }
    @media (prefers-color-scheme: light) {
      body { background: #ffffff; color: #333333; }
      .header { background: #f3f3f3; color: #333333; border-left-color: #007acc; }
      .content { background: #f8f8f8; color: #333333; }
      .tip { background: #f0f0f0; color: #666666; border-left-color: #007acc; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>DAT File Browser</h2>
    <p><strong>Platform:</strong> ${platform}</p>
    <p><strong>Source:</strong> ${source}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  </div>
  <div class="tip">
    💡 <strong>Tip:</strong> Use Ctrl+F (or Cmd+F on Mac) to search for specific ROMs in this DAT file.
  </div>
  <div class="content">${rawContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
</body>
</html>`;

          newWindow.document.write(htmlContent);
          newWindow.document.close();
        } else {
          toast.warning(
            "Failed to open new window. Please check your popup blocker settings.",
          );
        }
      } else {
        toast.error("Failed to load DAT content");
      }
    } catch (error) {
      console.error("Failed to browse DAT:", error);
      toast.error("Failed to browse DAT");
    }
  };

  const handleUploadCustomDAT = async (file: File) => {
    try {
      const result = await uploadCustomDAT(file);
      if (result.success) {
        toast.success("Custom DAT uploaded successfully!", {
          description: `Platform: ${result.platform}\nEntries: ${result.entryCount}`,
          duration: 5000,
        });
        loadCachedDATs();
      } else {
        toast.error(`Failed to upload DAT: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to upload custom DAT:", error);
      toast.error("Failed to upload custom DAT");
    }
  };

  const getSourceBadge = (source: string) => {
    const labels: Record<string, string> = {
      bundled: "Built-in",
      libretro: "Libretro",
      custom: "Custom",
    };
    const variants: Record<string, "secondary" | "outline" | "default"> = {
      bundled: "default",
      libretro: "secondary",
      custom: "outline",
    };
    return (
      <Badge variant={variants[source] || "secondary"}>
        {labels[source] || source}
      </Badge>
    );
  };

  const totalEntries = cachedDATs.reduce((sum, dat) => sum + dat.entryCount, 0);

  return (
    <div className="space-y-6">
      {/* Cached DAT Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cached DAT Files
          </CardTitle>
          <CardDescription>
            {cachedDATs.length > 0
              ? `${cachedDATs.length} platforms • ${totalEntries.toLocaleString()} total entries`
              : "No DAT files cached yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDATs ? (
            <div className="text-muted-foreground flex items-center justify-center py-8">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading cached DATs...
            </div>
          ) : cachedDATs.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No DAT files cached. DATs will be downloaded automatically when
                you validate ROMs.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {cachedDATs.map((dat) => (
                <div
                  key={`${dat.source}-${dat.platform}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="text-muted-foreground h-4 w-4" />
                    <div>
                      <div className="text-sm font-medium">{dat.platform}</div>
                      <div className="text-muted-foreground text-xs">
                        {dat.entryCount.toLocaleString()} entries
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSourceBadge(dat.source)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBrowseDAT(dat.platform, dat.source)}
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cachedDATs.length > 0 && (
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Cache
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Custom DAT */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Custom DAT
          </CardTitle>
          <CardDescription>
            Add your own DAT files for validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadDATButton onUpload={handleUploadCustomDAT} />
        </CardContent>
      </Card>
    </div>
  );
}

function UploadDATButton({
  onUpload,
}: {
  onUpload: (file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".dat,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setUploading(true);
        await onUpload(file);
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <Button onClick={handleClick} disabled={uploading} className="w-full">
      <Upload className="mr-2 h-4 w-4" />
      {uploading ? "Uploading..." : "Select DAT File"}
    </Button>
  );
}
