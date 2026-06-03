import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 삭제·종료 등 파괴적 액션이면 확인 버튼을 danger로 */
  destructive?: boolean;
}

export interface PromptOptions {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'number';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

/**
 * OS 기본 confirm/prompt/alert를 대체하는 자체 다이얼로그.
 * Promise 기반이라 기존 동기 호출을 `await confirm(...)` / `await prompt(...)`로 자연스럽게 치환할 수 있다.
 */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [value, setValue] = React.useState('');

  const confirm = React.useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ kind: 'confirm', opts, resolve })),
    [],
  );

  const prompt = React.useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(opts.defaultValue ?? '');
        setPending({ kind: 'prompt', opts, resolve });
      }),
    [],
  );

  // 한 번 열린 다이얼로그는 정확히 한 번만 resolve 한다.
  const settle = React.useCallback((result: boolean | string | null) => {
    setPending((cur) => {
      if (!cur) return null;
      if (cur.kind === 'confirm') cur.resolve(result as boolean);
      else cur.resolve(result as string | null);
      return null;
    });
  }, []);

  const ctx = React.useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  const isPrompt = pending?.kind === 'prompt';
  const cancelResult = isPrompt ? null : false;
  const destructive = pending?.kind === 'confirm' && pending.opts.destructive;

  return (
    <DialogContext.Provider value={ctx}>
      {children}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) settle(cancelResult); }}
      >
        {pending && (
          <DialogContent className="max-w-[340px]">
            <DialogHeader>
              <DialogTitle>{pending.opts.title}</DialogTitle>
              {pending.opts.description && (
                <p className="whitespace-pre-line text-sm leading-snug text-[var(--fg-muted)]">
                  {pending.opts.description}
                </p>
              )}
            </DialogHeader>

            {isPrompt && (
              <form onSubmit={(e) => { e.preventDefault(); settle(value.trim()); }}>
                <input
                  autoFocus
                  type={(pending.opts as PromptOptions).inputType ?? 'text'}
                  inputMode={(pending.opts as PromptOptions).inputMode}
                  placeholder={(pending.opts as PromptOptions).placeholder}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-3 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--fg-primary)] outline-none transition-colors focus:border-[var(--leaf)]"
                />
              </form>
            )}

            <div className="mt-5 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => settle(cancelResult)}>
                {pending.opts.cancelLabel ?? '취소'}
              </Button>
              <Button
                variant={destructive ? 'destructive' : 'default'}
                className="flex-1"
                onClick={() => settle(isPrompt ? value.trim() : true)}
              >
                {pending.opts.confirmLabel ?? '확인'}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('useConfirm must be used within <DialogProvider>');
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('usePrompt must be used within <DialogProvider>');
  return ctx.prompt;
}
