import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import ValidationSettings from "./ValidationSettings";
import DATSettings from "./DATSettings";

import { Moon, Sun, Menu, Github, Settings } from "lucide-react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [devToolsOpen, setDevToolsOpen] = React.useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
  const [datSettingsDialogOpen, setDatSettingsDialogOpen] =
    React.useState(false);
  const [cachedDATs, setCachedDATs] = React.useState<
    Array<{ platform: string; source: string; entryCount: number }>
  >([]);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = React.useState(false);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  const handleScrollTo = (elementId: string) => {
    // Check if we're on the home page (handle both / and trailing slash cases)
    const currentPath = window.location.pathname;
    if (currentPath !== "/" && currentPath !== "") {
      // Navigate to home page with hash
      window.location.href = `/#${elementId}`;
      return;
    }

    // We're on the home page, scroll to element
    const element = document.getElementById(elementId);
    if (element) {
      // Calculate offset to account for sticky header (64px = h-16)
      const headerHeight = 64;
      const elementTop = element.offsetTop - headerHeight;

      window.scrollTo({
        top: elementTop,
        behavior: "smooth",
      });
    }

    // Close mobile menu after navigation
    setMobileMenuOpen(false);
  };

  const handleClearCache = async () => {
    try {
      const { clearDATCache } = await import("@/utils/datLoader");
      clearDATCache();

      toast.success("DAT cache cleared successfully!");

      handleLoadCachedDATs();
      setClearCacheDialogOpen(false);
      setDevToolsOpen(false);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast.error("Failed to clear cache");
    }
  };

  const handleShowCacheStatus = async () => {
    try {
      const { getCacheStatus } = await import("@/utils/datLoader");
      const status = await getCacheStatus();

      toast.info("Cache Status", {
        description: (
          <div className="text-left">
            <p>Bundled: {status.bundled} DATs</p>
            <p>Memory: {status.memory} DATs</p>
            <p>Cached: {status.persistent} DATs</p>
            <p>Cache Size: {status.totalSize}</p>
          </div>
        ),
        duration: 8000,
      });

      setDevToolsOpen(false);
    } catch (error) {
      console.error("Failed to get cache status:", error);
      toast.error("Failed to get cache status");
    }
  };

  const handleLoadCachedDATs = async () => {
    try {
      const { getCachedDATs } = await import("@/utils/datLoader");
      const dats = await getCachedDATs();
      console.log("Loaded cached DATs:", dats);
      setCachedDATs(dats);
    } catch (error) {
      console.error("Failed to load cached DATs:", error);
      setCachedDATs([]);
    }
  };

  const handleBrowseDAT = async (platform: string, source: string) => {
    try {
      const { getRawDATContent } = await import("@/utils/datLoader");
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

      setDevToolsOpen(false);
    } catch (error) {
      console.error("Failed to browse DAT:", error);
      toast.error("Failed to browse DAT");
    }
  };

  const handleUploadCustomDAT = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".dat,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const { uploadCustomDAT } = await import("@/utils/datLoader");
          const result = await uploadCustomDAT(file);

          if (result.success) {
            toast.success("Custom DAT uploaded successfully!", {
              description: `Platform: ${result.platform}\nEntries: ${result.entryCount}`,
              duration: 5000,
            });
            handleLoadCachedDATs();
          } else {
            toast.error(`Failed to upload DAT: ${result.error}`);
          }
        } catch (error) {
          console.error("Failed to upload custom DAT:", error);
          toast.error("Failed to upload custom DAT");
        }
      }
    };
    input.click();
    setDevToolsOpen(false);
  };

  const handleDevToolsOpenChange = (open: boolean) => {
    setDevToolsOpen(open);
    if (open) {
      handleLoadCachedDATs();
    }
  };

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container mx-auto flex h-16 items-center px-4">
        {/* Left side - Logo */}
        <div className="flex items-center space-x-2">
          <div className="bg-primary hidden h-8 w-8 items-center justify-center rounded-md sm:flex">
            <span className="text-primary-foreground text-xs font-bold">
              ARV
            </span>
          </div>
          <a className="text-lg font-bold hover:underline" href="/">
            Auto ROM Validator
          </a>
        </div>

        {/* Center - Navigation */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 transform items-center space-x-6 md:flex">
          <button
            onClick={() => handleScrollTo("features")}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => handleScrollTo("upload")}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium transition-colors"
          >
            Upload
          </button>
          <a
            href="/about/"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            About
          </a>
        </nav>

        {/* Right side - Actions */}
        <div className="ml-auto flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-9 w-9 cursor-pointer p-0"
          >
            <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Button variant="ghost" size="sm" asChild className="h-9 w-9 p-0">
            <a
              href="https://github.com/RP2/rom-validate-web"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span className="sr-only">View on GitHub</span>
            </a>
          </Button>

          {/* Developer Tools Popover */}
          <Popover open={devToolsOpen} onOpenChange={handleDevToolsOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 cursor-pointer p-0"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Developer tools</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="end">
              <div className="flex flex-col space-y-1">
                <Button
                  variant="ghost"
                  className="cursor-pointer touch-manipulation justify-start px-3"
                  onClick={() => {
                    setDevToolsOpen(false);
                    setDatSettingsDialogOpen(true);
                  }}
                >
                  DAT Settings
                </Button>
                <Button
                  variant="ghost"
                  className="cursor-pointer touch-manipulation justify-start px-3"
                  onClick={() => {
                    setDevToolsOpen(false);
                    setSettingsDialogOpen(true);
                  }}
                >
                  Validation Settings
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* DAT Settings Dialog */}
          <Dialog
            open={datSettingsDialogOpen}
            onOpenChange={setDatSettingsDialogOpen}
          >
            <DialogContent className="flex max-h-[85vh] w-[90vw] max-w-2xl flex-col overflow-hidden">
              <DialogHeader>
                <DialogTitle>DAT Settings</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                <DATSettings />
              </div>
            </DialogContent>
          </Dialog>

          <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <PopoverTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={mobileMenuOpen}
                className="h-9 w-9 cursor-pointer p-0"
              >
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <div className="flex flex-col space-y-1">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => handleScrollTo("features")}
                >
                  Features
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => handleScrollTo("upload")}
                >
                  Upload
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    window.location.href = "/about/";
                  }}
                >
                  About
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Settings Dialog */}
          <Dialog
            open={settingsDialogOpen}
            onOpenChange={setSettingsDialogOpen}
          >
            <DialogContent className="flex max-h-[85vh] w-[90vw] max-w-2xl flex-col overflow-hidden">
              <DialogHeader>
                <DialogTitle>Validation Settings</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                <ValidationSettings />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
