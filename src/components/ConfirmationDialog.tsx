import { forwardRef, useImperativeHandle, useState } from 'react'

export type ConfirmationRequest = {
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => void
}

export type ConfirmationDialogHandle = { request: (confirmation: ConfirmationRequest) => void }

export const ConfirmationDialog = forwardRef<ConfirmationDialogHandle>(
    function ConfirmationDialog(_props, ref) {
        const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null)
        useImperativeHandle(ref, () => ({ request: setConfirmation }), [])
        if (!confirmation) return null
        return (
            <div
                className="fixed inset-0 z-40 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
                role="presentation"
            >
                <section
                    className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirmation-title"
                >
                    <h2 id="confirmation-title" className="m-0 text-base text-slate-50">
                        {confirmation.title}
                    </h2>
                    <p className="mb-5 mt-2 text-sm leading-relaxed text-slate-400">
                        {confirmation.description}
                    </p>
                    <div className="flex justify-end gap-2">
                        <button
                            className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-200"
                            type="button"
                            onClick={() => setConfirmation(null)}
                        >
                            Cancel
                        </button>
                        <button
                            className="cursor-pointer rounded-md border border-rose-400 bg-rose-700 px-3 py-2 text-white"
                            type="button"
                            onClick={() => {
                                confirmation.onConfirm()
                                setConfirmation(null)
                            }}
                        >
                            {confirmation.confirmLabel}
                        </button>
                    </div>
                </section>
            </div>
        )
    },
)
