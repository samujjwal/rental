import { useMemo, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { APP_LOCALE } from "~/config/locale";

type CategoryOption = { id: string; name: string };

type VoiceListingAssistantProps = {
  categories: CategoryOption[];
  onSetField: (field: string, value: unknown) => void;
  onNextStep?: () => void;
  onPrevStep?: () => void;
};

type VoiceRecognitionResultEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: VoiceRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserWindow = Window & {
  SpeechRecognition?: new () => VoiceRecognition;
  webkitSpeechRecognition?: new () => VoiceRecognition;
};

export function VoiceListingAssistant({
  categories,
  onSetField,
  onNextStep,
  onPrevStep,
}: VoiceListingAssistantProps) {
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [status, setStatus] = useState("");

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const browserWindow = window as BrowserWindow;
    return Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition);
  }, []);

  const applyCommand = (raw: string) => {
    const text = raw.trim();
    const normalized = text.toLowerCase();

    if (!text) return;

    if (normalized.includes("next step")) {
      onNextStep?.();
      setStatus("Moved to next step.");
      return;
    }
    if (normalized.includes("previous step") || normalized.includes("back step")) {
      onPrevStep?.();
      setStatus("Moved to previous step.");
      return;
    }

    const parseNumber = () => {
      const match = text.match(/(-?\d+(\.\d+)?)/);
      return match ? Number(match[1]) : undefined;
    };

    if (normalized.startsWith("title ")) {
      onSetField("title", text.slice(6).trim());
      setStatus("Updated title.");
      return;
    }
    if (normalized.startsWith("description ")) {
      onSetField("description", text.slice(12).trim());
      setStatus("Updated description.");
      return;
    }
    if (normalized.startsWith("rules ")) {
      onSetField("rules", text.slice(6).trim());
      setStatus("Updated rules.");
      return;
    }
    if (normalized.startsWith("address ")) {
      onSetField("location.address", text.slice(8).trim());
      setStatus("Updated address.");
      return;
    }
    if (normalized.startsWith("city ")) {
      onSetField("location.city", text.slice(5).trim());
      setStatus("Updated city.");
      return;
    }
    if (normalized.startsWith("state ")) {
      onSetField("location.state", text.slice(6).trim());
      setStatus("Updated state.");
      return;
    }
    if (normalized.startsWith("postal code ")) {
      onSetField("location.postalCode", text.slice(12).trim());
      setStatus("Updated postal code.");
      return;
    }
    if (normalized.startsWith("country ")) {
      onSetField("location.country", text.slice(8).trim());
      setStatus("Updated country.");
      return;
    }
    if (normalized.includes("price per day")) {
      const amount = parseNumber();
      if (amount !== undefined) {
        onSetField("basePrice", amount);
        setStatus("Updated daily price.");
      }
      return;
    }
    if (normalized.includes("security deposit")) {
      const amount = parseNumber();
      if (amount !== undefined) {
        onSetField("securityDeposit", amount);
        setStatus("Updated security deposit.");
      }
      return;
    }
    if (normalized.includes("minimum rental period")) {
      const value = parseNumber();
      if (value !== undefined) {
        onSetField("minimumRentalPeriod", Math.max(1, Math.round(value)));
        setStatus("Updated minimum rental period.");
      }
      return;
    }
    if (normalized.startsWith("category ")) {
      const requested = text.slice(9).trim().toLowerCase();
      const match = categories.find((category) =>
        category.name.toLowerCase().includes(requested)
      );
      if (match) {
        onSetField("category", match.id);
        setStatus(`Set category to ${match.name}.`);
      } else {
        setStatus("Category not recognized.");
      }
      return;
    }
    if (normalized.includes("instant booking on")) {
      onSetField("instantBooking", true);
      setStatus("Enabled instant booking.");
      return;
    }
    if (normalized.includes("instant booking off")) {
      onSetField("instantBooking", false);
      setStatus("Disabled instant booking.");
      return;
    }

    setStatus("Command not recognized.");
  };

  const startListening = () => {
    if (!supported || isListening) return;

    const browserWindow = window as BrowserWindow;
    const RecognitionCtor =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.lang = APP_LOCALE;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Listening...");
    };

    recognition.onresult = (event: VoiceRecognitionResultEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setLastHeard(transcript);
      applyCommand(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatus("Voice input failed. Please try again.");
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  if (!supported) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-input bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Voice assistant</p>
          <p className="text-xs text-muted-foreground">
            Say commands like "title ...", "price per day 45", or "next step".
          </p>
        </div>
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isListening ? "Stop" : "Speak"}
        </button>
      </div>
      {lastHeard ? (
        <p className="mt-2 text-xs text-muted-foreground">Heard: "{lastHeard}"</p>
      ) : null}
      {status ? <p className="mt-1 text-xs text-foreground">{status}</p> : null}
    </div>
  );
}
