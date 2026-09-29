"use client";
import { useEffect, useRef } from "react";

export default function Modal({ title, onClose, wide = false, children }) {
  const overlay = useRef(null),
    dialog = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector(".close")?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport && overlay.current)
        Object.assign(overlay.current.style, {
          left: viewport.offsetLeft + "px",
          top: viewport.offsetTop + "px",
          width: viewport.width + "px",
          height: viewport.height + "px",
          right: "auto",
          bottom: "auto",
        });
    };
    const keydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled),input,textarea,select,a[href],audio[controls]",
        ),
      ].filter((el) => el.getClientRects().length);
      const first = list[0],
        last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="overlay" ref={overlay}>
      <section
        className={`modal ${wide ? "wide" : ""}`}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
