import * as React from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

interface Props {
  onCreated: () => void
}

export function AddSupplierDialog({ onCreated }: Props) {
  const [open, setOpen] = React.useState(false)
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

  function reset() {
    setName("")
    setContactPerson("")
    setPhone("")
    setEmail("")
    setNif("")
    setRc("")
    setArtNumber("")
    setAddress("")
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim()) {
      setError("Supplier name is required.")
      return
    }
    setLoading(true)
    const { error: dbError } = await supabase.from("suppliers").insert({
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      nif: nif.trim() || null,
      rc: rc.trim() || null,
      art_number: artNumber.trim() || null,
      address: address.trim() || null,
    })
    setLoading(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    reset()
    setOpen(false)
    onCreated()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        setOpen(v)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Add Supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Supplier</DialogTitle>
          <DialogDescription>Register a new supplier to track shipments and packaging.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-name">Company Name</Label>
            <Input
              id="sup-name"
              placeholder="e.g. SPA PTD"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-contact">Contact Person (optional)</Label>
            <Input
              id="sup-contact"
              placeholder="e.g. Ahmed Ben Ali"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sup-phone">Phone (optional)</Label>
              <Input
                id="sup-phone"
                placeholder="+213 ..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sup-email">Email (optional)</Label>
              <Input
                id="sup-email"
                type="email"
                placeholder="supplier@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sup-address">Address (optional)</Label>
            <Input id="sup-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sup-rc">RC (optional)</Label>
              <Input id="sup-rc" value={rc} onChange={(e) => setRc(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sup-art">N° ART (optional)</Label>
              <Input id="sup-art" value={artNumber} onChange={(e) => setArtNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sup-nif">NIF (optional)</Label>
              <Input id="sup-nif" value={nif} onChange={(e) => setNif(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); setOpen(false) }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
