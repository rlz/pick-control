import { forwardRef, useImperativeHandle, useState } from 'react'

export type ConfirmationRequest = {
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => void
}

export type ConfirmationDialogHandle = { request: (confirmation: ConfirmationRequest) => void }

export const ConfirmationDialog = forwardRef<ConfirmationDialogHandle>(function ConfirmationDialog(_props, ref) {
    const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null)
    useImperativeHandle(ref, () => ({ request: setConfirmation }), [])
    if (!confirmation) return null
    return <div className="measure-editor-backdrop" role="presentation">
        <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
            <h2 id="confirmation-title">{confirmation.title}</h2>
            <p>{confirmation.description}</p>
            <div>
                <button type="button" onClick={() => setConfirmation(null)}>Cancel</button>
                <button className="confirm-danger" type="button" onClick={() => { confirmation.onConfirm(); setConfirmation(null) }}>{confirmation.confirmLabel}</button>
            </div>
        </section>
    </div>
})
