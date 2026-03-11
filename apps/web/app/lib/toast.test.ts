import { toast } from "./toast";

/* ── sonner mock ── */
const mockSuccess = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();
const mockWarning = vi.fn();
const mockLoading = vi.fn().mockReturnValue("loading-id");
const mockPromise = vi.fn();
const mockDismiss = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...a: any[]) => mockSuccess(...a),
    error: (...a: any[]) => mockError(...a),
    info: (...a: any[]) => mockInfo(...a),
    warning: (...a: any[]) => mockWarning(...a),
    loading: (...a: any[]) => mockLoading(...a),
    promise: (...a: any[]) => mockPromise(...a),
    dismiss: (...a: any[]) => mockDismiss(...a),
  },
}));

beforeEach(() => vi.clearAllMocks());

describe("toast", () => {
  describe("success", () => {
    it("calls sonner.success with message", () => {
      toast.success("Saved!");
      expect(mockSuccess).toHaveBeenCalledWith("Saved!", { description: undefined });
    });

    it("passes description", () => {
      toast.success("Saved!", "Profile updated");
      expect(mockSuccess).toHaveBeenCalledWith("Saved!", { description: "Profile updated" });
    });
  });

  describe("error", () => {
    it("calls sonner.error with message", () => {
      toast.error("Oops!");
      expect(mockError).toHaveBeenCalledWith("Oops!", {
        description: undefined,
        action: undefined,
      });
    });

    it("passes action button", () => {
      const onClick = vi.fn();
      toast.error("Oops!", "Something broke", { label: "Retry", onClick });
      expect(mockError).toHaveBeenCalledWith("Oops!", {
        description: "Something broke",
        action: { label: "Retry", onClick },
      });
    });
  });

  describe("info", () => {
    it("calls sonner.info", () => {
      toast.info("FYI");
      expect(mockInfo).toHaveBeenCalledWith("FYI", {
        description: undefined,
        action: undefined,
      });
    });

    it("passes action button", () => {
      const onClick = vi.fn();
      toast.info("FYI", "Details", { label: "View", onClick });
      expect(mockInfo).toHaveBeenCalledWith("FYI", {
        description: "Details",
        action: { label: "View", onClick },
      });
    });
  });

  describe("warning", () => {
    it("calls sonner.warning with message", () => {
      toast.warning("Careful!");
      expect(mockWarning).toHaveBeenCalledWith("Careful!", { description: undefined });
    });

    it("passes description", () => {
      toast.warning("Careful!", "Low battery");
      expect(mockWarning).toHaveBeenCalledWith("Careful!", { description: "Low battery" });
    });
  });

  describe("loading", () => {
    it("returns toast id", () => {
      const id = toast.loading("Loading...");
      expect(mockLoading).toHaveBeenCalledWith("Loading...", { description: undefined });
      expect(id).toBe("loading-id");
    });
  });

  describe("promise", () => {
    it("delegates to sonner.promise", () => {
      const p = Promise.resolve("data");
      const messages = {
        loading: "Saving...",
        success: "Saved!",
        error: "Failed!",
      };

      toast.promise(p, messages);

      expect(mockPromise).toHaveBeenCalledWith(p, messages);
    });
  });

  describe("dismiss", () => {
    it("dismisses by id", () => {
      toast.dismiss("toast-1");
      expect(mockDismiss).toHaveBeenCalledWith("toast-1");
    });

    it("dismisses all when no id", () => {
      toast.dismiss();
      expect(mockDismiss).toHaveBeenCalledWith(undefined);
    });
  });
});
