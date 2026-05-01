import { useEffect } from "react"
import { notifications } from "@mantine/notifications"

export function useGlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason)

      console.error("[Unhandled rejection]", event.reason)
      notifications.show({
        title: "Unexpected Error",
        message,
        color: "red",
        autoClose: 6000,
      })
    }

    const handleError = (event: ErrorEvent) => {
      console.error("[Global error]", event.error)
      notifications.show({
        title: "Unexpected Error",
        message: event.message || "An unknown error occurred",
        color: "red",
        autoClose: 6000,
      })
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    window.addEventListener("error", handleError)

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      window.removeEventListener("error", handleError)
    }
  }, [])
}
