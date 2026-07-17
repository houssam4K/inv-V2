import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { type Supplier } from "@/lib/types"

interface Props {
  supplier: Supplier | null
  open: boolean
  onClose: () => void
  onSaved: (updated: Supplier) => void
}

export function EditSupplierDialog({ supplier, open, onClose, onSaved }: Props) {
  const [name, setName] = React.useState("")
  const [contactPerson, setContactPerson] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [nif, setNif] = React.useState("")
  const [rc, setRc] = React.useState("")
  const [artNumber, setArtNumber] = React.useState("")
  const [address, setAddress] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (supplier && open) {
      setName(supplier.name)
      setContactPerson(supplier.contact_person ?? "")
      setPhone(supplier.phone ?? "")
      setEmail(supplier.email ?? "")
      setNif(supplier.nif ?? "")
      setRc(supplier.rc ?? "")
      setArtNumber(supplier.art_number ?? "")
      setAddress(supplier.address ?? "")
      setError("")
    }
  }, [supplier, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim()) { setError("Supplier name is required."); return }

    setLoading(true)
    const { data, error: dbErr } = await supabase
      .from("suppliers")
      .update({
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        nif: nif.trim() || null,
        rc: rc.trim() || null,
        art_number: artNumber.trim() || null,
        address: address.trim() || null,
      })
      .eq("id", supplier!.id)
      .select()
      .single()
    setLoading(false)

    if (dbErr) { setError(dbErr.message); return }
    onSaved(data as Supplier)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Supplier</DialogTitle>
          <DialogDescription>Update supplier information.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="esup-name">Company Name</Label>
            <Input id="esup-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="esup-contact">Contact Person (optional)</Label>
            <Input id="esup-contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="esup-phone">Phone (optional)</Label>
              <Input id="esup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esup-email">Email (optional)</Label>
              <Input id="esup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="esup-address">Address (optional)</Label>
            <Input id="esup-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="esup-rc">RC (optional)</Label>
              <Input id="esup-rc" value={rc} onChange={(e) => setRc(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esup-art">N° ART (optional)</Label>
              <Input id="esup-art" value={artNumber} onChange={(e) => setArtNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="esup-nif">NIF (optional)</Label>
              <Input id="esup-nif" value={nif} onChange={(e) => setNif(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
