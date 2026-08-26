"use client";

import type { ReactNode } from "react";
import { CommandLine } from "./command-line";
import { FNav } from "./f-nav";
import { HelpOverlay } from "./help-overlay";
import { useCommandRouter } from "./use-command-router";

/**
 * Phần shell cần state phía client: nav phím F, dòng lệnh, bảng trợ giúp và bộ
 * bắt phím. Nội dung màn (`children`) và thanh trạng thái (`statusBar`) vẫn do
 * server render rồi truyền vào — client chỉ bọc, không kéo chúng ra khỏi server.
 */
export function TerminalChrome({
  children,
  statusBar,
}: {
  children: ReactNode;
  statusBar: ReactNode;
}) {
  const { echo, helpOpen, toggleHelp, closeHelp, runCommand, openSymbolScreen } =
    useCommandRouter();

  return (
    <>
      <FNav onToggleHelp={toggleHelp} onOpenSymbol={openSymbolScreen} />

      <main id="main-content" className="tm-main" tabIndex={-1}>
        {children}
      </main>

      <CommandLine echo={echo} onRun={runCommand} />
      {statusBar}

      {helpOpen ? <HelpOverlay onClose={closeHelp} /> : null}
    </>
  );
}
