import * as React from "react"
import { FileText, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { suggestNextNumber } from "@/lib/documentNumbering"
import { exportReturnNotePDF } from "@/lib/pdf"
import type { Supplier, SupplierDocument, SupplierDocumentItem } from "@/lib/types"

interface Props {
  supplier: Supplier | null
  open: boolean
  onClose: () => void
  onDone: () => void
}

interface DraftItem {
  id: string
  code: string
  designation: string
  quantity: string
}

export function GenerateReturnNoteDialog({ supplier, open, onClose, onDone }: Props) {
  const [docNumber, setDocNumber] = React.useState("")
  const [date, setDate] = React.useState("")
  const [vCommande, setVCommande] = React.useState("")
  const [nCommande, setNCommande] = React.useState("")
  const [items, setItems] = React.useState<DraftItem[]>([])
  
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open && supplier) {
      const year = new Date().getFullYear()
      supabase.from("supplier_documents").select("number").eq("doc_type", "BR").then(({ data }) => {
        const next = suggestNextNumber(data || [], "BR", year)
        setDocNumber(next)
      })

      setDate(new Date().toISOString().slice(0, 10))
      setVCommande("")
      setNCommande("")
      setItems([{ id: crypto.randomUUID(), code: "", designation: "", quantity: "" }])
      setError("")
    }
  }, [open, supplier])

  function addItem() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), code: "", designation: "", quantity: "" }])
  }

  function removeItem(id: string) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function updateItem(id: string, field: keyof DraftItem, value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!docNumber.trim()) { setError("Le numéro est requis."); return }
    if (!date) { setError("La date est requise."); return }

    const cleanItems = items.map((it, i) => ({
      position: i,
      code: it.code.trim() || null,
      designation: it.designation.trim(),
      quantity: parseFloat(it.quantity),
      unit: null,
      unit_price: null,
    }))

    for (const it of cleanItems) {
      if (!it.designation) { setError("La désignation est requise pour toutes les lignes."); return }
      if (isNaN(it.quantity) || it.quantity <= 0) { setError("Quantité invalide sur une ligne."); return }
    }

    setLoading(true)

    // 1. Insert document
    const { data: docData, error: docErr } = await supabase.from("supplier_documents").insert({
      doc_type: "BR",
      number: docNumber.trim(),
      supplier_id: supplier!.id,
      date,
      v_commande: vCommande.trim() || null,
      n_commande: nCommande.trim() || null,
    }).select().single()

    if (docErr) {
      setLoading(false)
      if (docErr.message.includes("unique constraint") || docErr.code === "23505") {
        setError("Ce numéro de Bon de Retour existe déjà, choisis-en un autre.")
      } else {
        setError(docErr.message)
      }
      return
    }

    // 2. Insert items
    const { error: itemsErr } = await supabase.from("supplier_document_items").insert(
      cleanItems.map(it => ({ ...it, document_id: docData.id }))
    ).select()

    if (itemsErr) {
      setLoading(false)
      setError(itemsErr.message)
      return
    }

    // 3. Generate PDF
    const { data: insertedItems } = await supabase.from("supplier_document_items").select("*").eq("document_id", docData.id).order("position")
    exportReturnNotePDF(supplier!, docData as SupplierDocument, insertedItems as SupplierDocumentItem[])

    setLoading(false)
    onDone()
  }

  if (!supplier) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Générer Bon de Retour
            </DialogTitle>
            <DialogDescription>
              Pour <span className="font-medium text-foreground">{supplier.name}</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* En-tête doc */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-number">Numéro BR</Label>
              <Input id="br-number" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-date">Date</Label>
              <Input id="br-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-vcmd">V/Commande (optionnel)</Label>
              <Input id="br-vcmd" value={vCommande} onChange={(e) => setVCommande(e.target.value)} placeholder="Réf. commande fournisseur" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-ncmd">N/Commande (optionnel)</Label>
              <Input id="br-ncmd" value={nCommande} onChange={(e) => setNCommande(e.target.value)} placeholder="Réf. commande interne" />
            </div>
          </div>

          {/* Lignes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Lignes d'articles</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 gap-1">
                <Plus className="size-3.5" />
                Ajouter une ligne
              </Button>
            </div>
            
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex gap-2 items-start bg-muted/30 p-2 rounded-md border">
                  <div className="grid grid-cols-12 gap-2 flex-1">
                    <div className="col-span-3">
                      <Input placeholder="Code" value={it.code} onChange={(e) => updateItem(it.id, "code", e.target.value)} className="h-8" />
                    </div>
                    <div className="col-span-6">
                      <Input placeholder="Désignation Emballage" value={it.designation} onChange={(e) => updateItem(it.id, "designation", e.target.value)} className="h-8" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" step="any" placeholder="Qté" value={it.quantity} onChange={(e) => updateItem(it.id, "quantity", e.target.value)} className="h-8" />
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeItem(it.id)} disabled={items.length === 1}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          
          <div className="pt-4 border-t flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? "Génération..." : "Générer & Télécharger"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
