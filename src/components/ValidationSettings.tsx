import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, AlertTriangle } from "lucide-react";
import { getStoredSettings, saveSettings } from "@/utils/validationSettings";

const WORKER_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4 (Default)" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
] as const;

export default function ValidationSettings() {
  const [settings, setSettings] = useState({
    autoRename: true,
    skipLargeFiles: false,
    maxFileSize: 1024,
    verboseOutput: false,
    parallelWorkers: "4",
  });

  useEffect(() => {
    const stored = getStoredSettings();
    setSettings((prev) => ({ ...prev, ...stored }));
  }, []);

  const updateSettings = (updates: Partial<typeof settings>) => {
    setSettings((prev) => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  };

  return (
    <div className="space-y-6">
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
                  updateSettings({ autoRename: !settings.autoRename })
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
                    updateSettings({ skipLargeFiles: !settings.skipLargeFiles })
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
                      updateSettings({
                        maxFileSize: parseInt(e.target.value) || 1024,
                      })
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
                  updateSettings({ verboseOutput: !settings.verboseOutput })
                }
              >
                {settings.verboseOutput ? "Enabled" : "Disabled"}
              </Button>
            </div>

            {/* Parallel Processing */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Parallel Processing</h4>
                <p className="text-muted-foreground text-sm">
                  Process multiple files concurrently using Web Workers
                </p>
              </div>
              <Select
                value={settings.parallelWorkers}
                onValueChange={(value) =>
                  updateSettings({ parallelWorkers: value })
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Alert className="bg-muted/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Parallel processing runs entirely in your browser - no data is
                sent to external servers. Higher worker counts use more memory.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
