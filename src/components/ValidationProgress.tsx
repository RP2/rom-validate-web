import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

interface ProgressStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  progress?: number;
  description?: string;
}

interface ValidationProgressProps {
  steps: ProgressStep[];
  currentStep: string;
  overallProgress: number;
}

export default function ValidationProgress({
  steps,
  currentStep,
  overallProgress,
}: ValidationProgressProps) {
  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "active":
        return <Loader2 className="text-primary h-5 w-5 animate-spin" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="text-muted-foreground h-5 w-5" />;
    }
  };

  const getStepVariants = (status: string) => ({
    pending: { opacity: 0.5, scale: 0.95 },
    active: { opacity: 1, scale: 1 },
    completed: { opacity: 1, scale: 1 },
    error: { opacity: 1, scale: 1 },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Validation Progress</h3>
              <span className="text-muted-foreground text-sm">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Step Details */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial="pending"
                animate={step.status}
                variants={getStepVariants(step.status)}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  step.status === "active"
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{
                    rotate: step.status === "active" ? 360 : 0,
                  }}
                  transition={{
                    duration: 2,
                    repeat: step.status === "active" ? Infinity : 0,
                    ease: "linear",
                  }}
                >
                  {getStepIcon(step)}
                </motion.div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{step.label}</h4>
                    {step.status === "active" &&
                      step.progress !== undefined && (
                        <span className="text-muted-foreground text-xs">
                          {Math.round(step.progress)}%
                        </span>
                      )}
                  </div>

                  {step.description && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {step.description}
                    </p>
                  )}

                  {step.status === "active" && step.progress !== undefined && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="mt-2"
                    >
                      <Progress value={step.progress} className="h-1" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
