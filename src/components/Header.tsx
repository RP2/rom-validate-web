import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Moon, Sun, Menu, Github, Settings } from "lucide-react";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [devToolsOpen, setDevToolsOpen] = React.useState(false);
  const [cachedDATs, setCachedDATs] = React.useState<
    Array<{ platform: string; source: string; entryCount: number }>
  >([]);

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
    // Show confirmation dialog
    const confirmed = confirm(
      "Are you sure you want to clear all cached DAT files?\n\n" +
        "This will remove:\n" +
        "• All downloaded Libretro DAT files\n" +
        "• All uploaded custom DAT files\n" +
        "• Cached validation data\n\n" +
        "Bundled DAT files will remain available and are not affected.",
    );

    if (!confirmed) {
      return;
    }

    try {
      const { clearDATCache } = await import("@/utils/datLoader");
      clearDATCache();

      // Use console.log for mobile debugging and alert as fallback
      console.log("DAT cache cleared successfully!");
      alert("DAT cache cleared successfully!");

      // Refresh the cached DATs list to reflect changes
      handleLoadCachedDATs();
      setDevToolsOpen(false);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      alert("Failed to clear cache");
    }
  };

  const handleShowCacheStatus = async () => {
    try {
      const { getCacheStatus } = await import("@/utils/datLoader");
      const status = await getCacheStatus();
      const message =
        `Cache Status:\n` +
        `Bundled: ${status.bundled} DATs\n` +
        `Memory: ${status.memory} DATs\n` +
        `Cached: ${status.persistent} DATs\n` +
        `Cache Size: ${status.totalSize}`;

      // Use console.log for mobile debugging and alert as fallback
      console.log(message);
      alert(message);
      setDevToolsOpen(false);
    } catch (error) {
      console.error("Failed to get cache status:", error);
      alert("Failed to get cache status");
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
        // Create a new window/tab with the DAT content
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
          alert(
            "Failed to open new window. Please check your popup blocker settings.",
          );
        }
      } else {
        alert("Failed to load DAT content");
      }

      setDevToolsOpen(false);
    } catch (error) {
      console.error("Failed to browse DAT:", error);
      alert("Failed to browse DAT");
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
            alert(
              `Custom DAT uploaded successfully!\nPlatform: ${result.platform}\nEntries: ${result.entryCount}`,
            );
            // Refresh the cached DATs list
            handleLoadCachedDATs();
          } else {
            alert(`Failed to upload DAT: ${result.error}`);
          }
        } catch (error) {
          console.error("Failed to upload custom DAT:", error);
          alert("Failed to upload custom DAT");
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
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
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
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                  onClick={handleShowCacheStatus}
                >
                  Cache Status
                </Button>
                <Button
                  variant="ghost"
                  className="cursor-pointer touch-manipulation justify-start px-3"
                  onClick={handleClearCache}
                >
                  Clear DAT Cache
                </Button>
                <Button
                  variant="ghost"
                  className="cursor-pointer touch-manipulation justify-start px-3"
                  onClick={handleUploadCustomDAT}
                >
                  Upload Custom DAT
                </Button>
                {cachedDATs.length > 0 && (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="cached-dats" className="border-none">
                      <AccordionTrigger className="hover:bg-accent hover:text-accent-foreground cursor-pointer px-3 py-2 text-sm font-medium hover:no-underline">
                        Browse DATs ({cachedDATs.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <div className="flex flex-col space-y-1">
                          <div className="text-muted-foreground px-3 py-2 text-xs font-medium">
                            Select DAT to browse:
                          </div>
                          {cachedDATs.map((dat) => (
                            <Button
                              key={`${dat.platform}-${dat.source}`}
                              variant="ghost"
                              size="sm"
                              className="h-auto w-full cursor-pointer touch-manipulation justify-start px-3 py-2 text-xs"
                              onClick={() =>
                                handleBrowseDAT(dat.platform, dat.source)
                              }
                            >
                              <div className="flex w-full min-w-0 flex-col items-start">
                                <span className="w-full truncate text-left font-medium">
                                  {dat.platform}
                                </span>
                                <span className="text-muted-foreground w-full truncate text-left">
                                  {dat.source} • {dat.entryCount} entries
                                </span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            </PopoverContent>
          </Popover>

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
        </div>
      </div>
    </header>
  );
}
