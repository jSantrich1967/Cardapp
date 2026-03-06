"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface CardItem {
  id: string;
  cardholderName: string;
  last4: string;
  status: string;
  createdAt: string;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ cardholderName: "", last4: "" });

  const fetchCards = async () => {
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/cards");
      if (res.ok) {
        const data = await res.json();
        setCards(data);
      } else {
        setError("Error al cargar tarjetas");
      }
    } catch {
      setCards([]);
      setError("No se pudo conectar. Revisa que el servidor esté corriendo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editId ? `/api/cards/${editId}` : "/api/cards";
    const method = editId ? "PATCH" : "POST";
    const body = editId ? { ...form } : form;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setOpen(false);
      setEditId(null);
      setForm({ cardholderName: "", last4: "" });
      fetchCards();
    } else {
      const err = await res.json();
      alert(err.error || "Error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta tarjeta? Se eliminarán todas sus transacciones.")) return;
    const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
    if (res.ok) fetchCards();
    else alert("Error al eliminar");
  };

  const openEdit = (c: CardItem) => {
    setEditId(c.id);
    setForm({ cardholderName: c.cardholderName, last4: c.last4 });
    setOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ cardholderName: "", last4: "" });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tarjetas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva tarjeta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar tarjeta" : "Nueva tarjeta"}</DialogTitle>
              <DialogDescription>
                Ingresa el nombre del titular y los últimos 4 dígitos de la tarjeta.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del titular</Label>
                <Input
                  id="name"
                  value={form.cardholderName}
                  onChange={(e) => setForm((f) => ({ ...f, cardholderName: e.target.value }))}
                  placeholder="Ej: Iris Briceño"
                  required
                />
              </div>
              <div>
                <Label htmlFor="last4">Últimos 4 dígitos</Label>
                <Input
                  id="last4"
                  value={form.last4}
                  onChange={(e) => setForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="5601"
                  maxLength={4}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editId ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={fetchCards}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              No hay tarjetas. Crea una para comenzar a importar transacciones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">{c.cardholderName}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">•••• {c.last4}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{c.status}</p>
                <Link href={`/transactions?cardId=${c.id}`}>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Ver transacciones
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
