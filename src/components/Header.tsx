import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, Menu, Github, Settings } from "lucide-react";

export default function Header() {
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
  };

  const handleClearCache = async () => {
    try {
      const { clearDATCache } = await import("@/utils/datLoader");
      clearDATCache();
      alert("DAT cache cleared successfully!");
    } catch (error) {
      console.error("Failed to clear cache:", error);
      alert("Failed to clear cache");
    }
  };

  const handleShowCacheStatus = async () => {
    try {
      const { getCacheStatus } = await import("@/utils/datLoader");
      const status = getCacheStatus();
      alert(
        `Cache Status:\n` +
          `Memory: ${status.memory} DATs\n` +
          `Persistent: ${status.persistent} DATs\n` +
          `Storage Size: ${status.totalSize}`,
      );
    } catch (error) {
      console.error("Failed to get cache status:", error);
      alert("Failed to get cache status");
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

          {/* Developer Tools Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 cursor-pointer touch-manipulation p-0"
                style={{ touchAction: "manipulation" }}
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Developer tools</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleShowCacheStatus}
                className="cursor-pointer"
              >
                Cache Status
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleClearCache}
                className="cursor-pointer"
              >
                Clear DAT Cache
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 cursor-pointer touch-manipulation p-0"
                style={{ touchAction: "manipulation" }}
              >
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleScrollTo("features")}>
                <span className="cursor-pointer">Features</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScrollTo("upload")}>
                <span className="cursor-pointer">Upload</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <a href="/about/" className="cursor-pointer">
                  About
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
