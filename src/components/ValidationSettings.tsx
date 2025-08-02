import { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  Download,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Platform {
  id: string;
  name: string;
  lastUpdated: string;
  fileCount: number;
  status: "available" | "downloading" | "updated" | "error";
}

export default function ValidationSettings() {
  const [platforms, setPlatforms] = useState<Platform[]>([
    {
      id: "nintendo-ds",
      name: "Nintendo DS",
      lastUpdated: "2024-01-15",
      fileCount: 6757,
      status: "available",
    },
    {
      id: "nintendo-3ds",
      name: "Nintendo 3DS",
      lastUpdated: "2024-01-10",
      fileCount: 2341,
      status: "available",
    },
    {
      id: "game-boy-advance",
      name: "Game Boy Advance",
      lastUpdated: "2023-12-20",
      fileCount: 2847,
      status: "available",
    },
    {
      id: "nintendo-64",
      name: "Nintendo 64",
      lastUpdated: "2023-11-30",
      fileCount: 388,
      status: "available",
    },
  ]);

  const [settings, setSettings] = useState({
    autoRename: true,
    skipLargeFiles: false,
    maxFileSize: 1024, // MB
    verboseOutput: false,
  });

  const downloadDAT = async (platformId: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId ? { ...p, status: "downloading" } : p,
      ),
    );

    try {
      // Simulate download
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === platformId
            ? {
                ...p,
                status: "updated",
                lastUpdated: new Date().toISOString().split("T")[0],
              }
            : p,
        ),
      );
    } catch (error) {
      setPlatforms((prev) =>
        prev.map((p) => (p.id === platformId ? { ...p, status: "error" } : p)),
      );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "downloading":
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case "updated":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="text-muted-foreground h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      available: "secondary",
      downloading: "default",
      updated: "outline",
      error: "destructive",
    } as const;

    const labels = {
      available: "Available",
      downloading: "Downloading...",
      updated: "Updated",
      error: "Error",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* DAT Files Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            DAT Files Management
          </CardTitle>
          <CardDescription>
            Download and manage validation databases for different platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {platforms.map((platform) => (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="border-border flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(platform.status)}
                  <div>
                    <h4 className="font-medium">{platform.name}</h4>
                    <div className="text-muted-foreground mt-1 flex items-center gap-4 text-xs">
                      <span>Last updated: {platform.lastUpdated}</span>
                      <span>{platform.fileCount.toLocaleString()} files</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(platform.status)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDAT(platform.id)}
                    disabled={platform.status === "downloading"}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {platform.status === "downloading"
                      ? "Downloading..."
                      : "Update"}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              DAT files are downloaded from official No-Intro and Redump
              databases via Libretro's repository. Large files may take several
              minutes to download and process.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Validation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Validation Settings
          </CardTitle>
          <CardDescription>
            Configure how ROM validation and processing works
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Auto Rename */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Auto-rename files</h4>
                <p className="text-muted-foreground text-sm">
                  Automatically rename files to match official DAT names
                </p>
              </div>
              <Button
                variant={settings.autoRename ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    autoRename: !prev.autoRename,
                  }))
                }
              >
                {settings.autoRename ? "Enabled" : "Disabled"}
              </Button>
            </div>

            {/* Skip Large Files */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Skip large files</h4>
                  <p className="text-muted-foreground text-sm">
                    Skip files larger than specified size to improve performance
                  </p>
                </div>
                <Button
                  variant={settings.skipLargeFiles ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      skipLargeFiles: !prev.skipLargeFiles,
                    }))
                  }
                >
                  {settings.skipLargeFiles ? "Enabled" : "Disabled"}
                </Button>
              </div>

              {settings.skipLargeFiles && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <Input
                    type="number"
                    value={settings.maxFileSize}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        maxFileSize: parseInt(e.target.value) || 1024,
                      }))
                    }
                    className="w-24"
                    min="1"
                    max="10240"
                  />
                  <span className="text-muted-foreground text-sm">MB</span>
                </motion.div>
              )}
            </div>

            {/* Verbose Output */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Verbose output</h4>
                <p className="text-muted-foreground text-sm">
                  Show detailed information during validation process
                </p>
              </div>
              <Button
                variant={settings.verboseOutput ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    verboseOutput: !prev.verboseOutput,
                  }))
                }
              >
                {settings.verboseOutput ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
