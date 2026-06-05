"use client";

import { useEffect, useRef, type MouseEvent } from "react";

/**
 * Handlers pra fechar modal ao clicar no overlay (fora do card).
 * So fecha quando press E release acontecem no proprio overlay — assim
 * arrastar pra selecionar texto dentro do card e soltar fora nao fecha.
 * Tambem fecha no Esc (padrao de acessibilidade de dialog).
 */
export function useOverlayClose(onClose: () => void) {
  const pressedOnOverlay = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return {
    onMouseDown: (e: MouseEvent) => { pressedOnOverlay.current = e.target === e.currentTarget; },
    onMouseUp: (e: MouseEvent) => {
      if (pressedOnOverlay.current && e.target === e.currentTarget) onClose();
      pressedOnOverlay.current = false;
    },
  };
}
