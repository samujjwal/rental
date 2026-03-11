import { cn } from "~/lib/utils";
import { CheckCircle } from "lucide-react";

interface Step {
  id: number;
  name: string;
}

interface ListingStepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function ListingStepIndicator({
  steps,
  currentStep,
}: ListingStepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
                currentStep > step.id
                  ? "bg-success text-success-foreground"
                  : currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {currentStep > step.id ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                step.id
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-full h-1 mx-2 transition-colors",
                  currentStep > step.id ? "bg-success" : "bg-muted"
                )}
                style={{ minWidth: "60px" }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        {steps.map((step) => (
          <div
            key={step.id}
            className="text-center"
            style={{ width: "80px" }}
          >
            {step.name}
          </div>
        ))}
      </div>
    </div>
  );
}
