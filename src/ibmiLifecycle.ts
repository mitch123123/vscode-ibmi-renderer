import * as vscode from "vscode";
import { DspfDesignerProvider, VIEW_TYPE } from "./ui";

const CODE_FOR_IBMI_ID = `halcyontechltd.code-for-ibmi`;
const REMOTE_SCHEMES = new Set([`member`, `streamfile`, `object`]);

type CodeForIbmiInstance = {
  getConnection(): unknown | undefined;
  /** Set while connect()/reconnect is in flight (public on Instance). */
  connected?: Promise<unknown>;
  subscribe(
    context: vscode.ExtensionContext,
    event: string,
    name: string,
    func: () => void | Promise<void>,
    transient?: boolean
  ): void;
};

/**
 * Soft-integrate with Code for IBM i so remote designer tabs follow the same
 * disconnect/reconnect lifecycle as member/streamfile text editors.
 *
 * Code for IBM i only auto-closes TabInputText on disconnect(false). Our
 * designer is TabInputCustom, so we close those ourselves when remote text
 * tabs are bulk-closed after a declined reconnect (or when reconnect never
 * starts). While disconnected / reconnecting, remote designers are read-only.
 *
 * IMPORTANT: `disconnected` subscribers are awaited before the reconnect
 * modal appears — handlers here must not block.
 */
export function registerIbmiConnectionLifecycle(context: vscode.ExtensionContext): void {
  const ext = vscode.extensions.getExtension<{ instance?: CodeForIbmiInstance }>(CODE_FOR_IBMI_ID);
  if (!ext) {
    return;
  }

  let pendingDisconnect = false;

  const setRemoteDesignersReadonly = (next: boolean) => {
    DspfDesignerProvider.setRemoteSessionsReadonly(next);
  };

  const closeRemoteDesignerTabs = async () => {
    const tabs = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter((tab) => {
        if (!(tab.input instanceof vscode.TabInputCustom)) {
          return false;
        }
        if (tab.input.viewType !== VIEW_TYPE) {
          return false;
        }
        return REMOTE_SCHEMES.has(tab.input.uri.scheme);
      });

    if (tabs.length > 0) {
      await vscode.window.tabGroups.close(tabs);
    }
  };

  /**
   * After `disconnected` fires, Code for IBM i shows the reconnect modal and
   * then calls disconnect(reconnect). We wait (without blocking the event
   * handler) until the connection object is cleared, then either keep tabs
   * open if reconnect started (`instance.connected` promise) or close them.
   */
  const afterDisconnectSettled = async (instance: CodeForIbmiInstance) => {
    const start = Date.now();
    while (instance.getConnection() && Date.now() - start < 300_000) {
      if (!pendingDisconnect) {
        return;
      }
      await delay(100);
    }

    if (!pendingDisconnect) {
      return;
    }

    // Let reconnect's connect() assign instance.connected if the user chose Yes
    await delay(100);

    if (!pendingDisconnect) {
      return;
    }

    if (instance.connected) {
      try {
        await instance.connected;
      } catch {
        // reconnect attempt failed / cancelled
      }
      // Match Code for IBM i: after a reconnect attempt, editors stay open
      // even if the attempt was abandoned (text tabs are not closed either).
      return;
    }

    // No reconnect in flight — user declined (or disconnected without prompt)
    if (pendingDisconnect && !instance.getConnection()) {
      pendingDisconnect = false;
      await closeRemoteDesignerTabs();
      setRemoteDesignersReadonly(false);
    }
  };

  const activateAndSubscribe = async () => {
    try {
      const api = ext.isActive ? ext.exports : await ext.activate();
      const instance = api?.instance;
      if (!instance?.subscribe || !instance.getConnection) {
        return;
      }

      instance.subscribe(context, `disconnected`, `DDS designer: connection lost`, () => {
        pendingDisconnect = true;
        setRemoteDesignersReadonly(true);
        // Must not await — Code for IBM i waits for this handler before the modal
        void afterDisconnectSettled(instance);
      });

      instance.subscribe(context, `connected`, `DDS designer: connection restored`, () => {
        pendingDisconnect = false;
        setRemoteDesignersReadonly(false);
      });

      // When remote text tabs are closed as part of disconnect(false) (declined
      // reconnect or manual disconnect), close our custom editor tabs too.
      // Tab close happens before setConnection() clears the connection, so wait
      // briefly before checking. During reconnect, text tabs are not closed.
      context.subscriptions.push(
        vscode.window.tabGroups.onDidChangeTabs(async (e) => {
          const closedRemoteText = e.closed.filter((tab) => {
            if (!(tab.input instanceof vscode.TabInputText)) {
              return false;
            }
            return REMOTE_SCHEMES.has(tab.input.uri.scheme);
          });

          if (closedRemoteText.length === 0) {
            return;
          }

          await delay(150);

          if (instance.getConnection() || instance.connected) {
            return;
          }

          pendingDisconnect = false;
          await closeRemoteDesignerTabs();
          setRemoteDesignersReadonly(false);
        })
      );
    } catch (error) {
      console.error(`Failed to hook Code for IBM i connection lifecycle`, error);
    }
  };

  void activateAndSubscribe();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
