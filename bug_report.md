# 🐛 Logic & Calculation Bug Report — Stock Accuracy

After auditing all the pages, dialogs, and migrations you asked about, here's what I found. Bugs are ordered by severity — the ones at the top **will** silently corrupt your stock data.

---

## 🔴 CRITICAL — Will cause false stock data

### BUG 1: Deleting a supplier does NOT update `current_quantity` (stock corrupts silently)

**File**: [Suppliers.tsx](file:///d:/inventory/inv-V2/src/pages/Suppliers.tsx#L993-L1021)

When you delete a supplier, the code manually deletes the linked `stock_movements` rows:

```typescript
// Line 1006-1011
const { data: movRows } = await supabase
  .from("stock_movements")
  .select("id, raw_material_id, quantity")
  .in("shipment_id", shipIds)
if (movRows && movRows.length > 0) {
  await supabase.from("stock_movements").delete().in("id", movRows.map((m) => m.id))
}
```

This correctly deletes the movements, and the DB trigger recalculates `current_quantity`. **However**, the problem is the cascade: `suppliers → shipments → stock_movements` via `ON DELETE CASCADE`. The code deletes movements first, then deletes the supplier which **cascades to delete shipments**. But if there are any `stock_movements` linked by `shipment_id` that were missed (e.g., timing issues) OR if the `raw_material_id` foreign key cascade on `shipments` has changed, the trigger fires correctly.

**Actually, the real bug is different**: the code queries `stock_movements` by `shipment_id`, but stock movements can also be created **without** a `shipment_id` (e.g., manual IN movements from `StockMovementDialog`). The cascade delete on `raw_materials → stock_movements` handles cleanup, but **deleting a supplier doesn't delete the raw material**. 

> [!CAUTION]
> **The actual critical issue**: After deleting all the `stock_movements` linked to shipments and then deleting the supplier (which cascades and deletes `shipments`), the trigger correctly recalculates `current_quantity`. **BUT** if the `supabase.from("stock_movements").delete()` call fails silently or the `.in()` query returns partial results due to Supabase's default row limit, some movements won't be deleted and stock will be wrong.
>
> Supabase's default `PGRST_MAX_ROWS` could truncate the `.in("shipment_id", shipIds)` or `.in("id", ...)` queries if there are many shipments. For a factory with hundreds of shipments, this is a real risk.

**Fix**: Instead of manually deleting movements in JS, let the DB cascade handle it. Either:
1. Add `ON DELETE CASCADE` from `stock_movements.shipment_id` → `shipments.id` (currently it's not set, it's just a nullable FK), OR
2. Delete movements using a single query per raw material with `raw_material_id` filter, OR
3. Rely on the trigger: just delete the supplier and let cascades + trigger handle the rest.

---

### BUG 2: Deleting a shipment only deletes ONE stock movement (should delete ALL linked)

**File**: [Suppliers.tsx](file:///d:/inventory/inv-V2/src/pages/Suppliers.tsx#L520-L548)

```typescript
// Line 525-529
const { data: movRows } = await supabase
  .from("stock_movements")
  .select("id")
  .eq("shipment_id", deleteShipmentTarget.id)
  .limit(1)  // ⚠️ ONLY FETCHES 1
```

> [!WARNING]
> The `.limit(1)` means if somehow there are multiple stock movements linked to one shipment (e.g., due to a past bug, manual entry, or race condition), **only the first one gets deleted**. The rest remain, keeping phantom stock in the system.
> 
> This could happen if someone edits a shipment's stock movement then re-creates a new one, or if the app re-submits.

**Fix**: Remove `.limit(1)` and delete **all** movements matching the `shipment_id`.

---

### BUG 3: Physical Inventory records discrepancies but NEVER adjusts stock

**File**: [NewInventoryDialog.tsx](file:///d:/inventory/inv-V2/src/components/NewInventoryDialog.tsx#L55-L94)

When you do a physical inventory count, the dialog saves the theoretical vs. real quantities into `inventory_entries`, but **never creates a stock movement to correct the difference**. 

> [!CAUTION]
> This means your physical inventory feature is **documentation-only**. If you count 100 kg but the system says 150 kg, the system will STILL show 150 kg after saving. Your "Days Left", forecast chart, and stock status will all remain wrong. 
>
> For a factory inventory app, this is the most impactful bug — physical inventory is supposed to be the source of truth that corrects system drift.

**Fix**: After saving inventory entries, create an adjustment `stock_movement` (IN or OUT) for each material where `real_quantity ≠ theoretical_quantity`, with a note like "Physical inventory adjustment". This will trigger the DB trigger to update `current_quantity`.

---

### BUG 4: `EditStockMovementDialog` allows changing IN→OUT but the OUT validation against current stock is missing

**File**: [EditStockMovementDialog.tsx](file:///d:/inventory/inv-V2/src/components/EditStockMovementDialog.tsx#L53-L82)

When editing a stock movement, the user can change the type from `IN` to `OUT` or increase the `OUT` quantity. There is **no validation** that this won't make the stock go negative:

```typescript
// Line 57-58 — only checks positive qty, NOT stock availability
const qty = parseFloat(quantity)
if (isNaN(qty) || qty <= 0) { ... }
```

> [!WARNING]
> If someone changes a 500 IN movement to a 500 OUT movement, that's a **1000-unit swing**. The DB has a `CHECK (current_quantity >= 0)` constraint that will reject this, but the error message shown to the user will be the raw Postgres error — not a user-friendly message. More importantly, the dialog will show "Saving..." indefinitely or display a cryptic error.

**Fix**: Either add a client-side check similar to `StockMovementDialog` (line 65), or properly catch and translate the `current_quantity_non_negative` constraint error into a user-friendly message (like `StockMovementDialog` does at line 87).

---

## 🟠 IMPORTANT — Incorrect display / calculation bugs

### BUG 5: `MaterialDetail` — "Stock at start of month" shows fractional numbers due to floating-point

**File**: [MaterialDetail.tsx](file:///d:/inventory/inv-V2/src/pages/MaterialDetail.tsx#L369-L401)

The `stockAtStartOfMonth` calculation involves subtracting the first movement's quantity from `balanceAfter`. With floating-point numbers (common for kg, liters), this will accumulate precision errors:

```typescript
// Line 376-380
return (
  firstOfMonth.balanceAfter -
  (firstOfMonth.movement_type === "IN"
    ? Number(firstOfMonth.quantity)
    : -Number(firstOfMonth.quantity))
);
```

For example, if `balanceAfter` is `150.00000000000003` and quantity is `50`, the start-of-month stock shows as `100.00000000000003` instead of `100`.

**Fix**: Round the result: `Math.round(result * 100) / 100` or use `Number(result.toFixed(2))`.

---

### BUG 6: `MaterialDetail` — `balanceAfter` values in movement history can show negative stock

**File**: [MaterialDetail.tsx](file:///d:/inventory/inv-V2/src/pages/MaterialDetail.tsx#L290-L304)

The `balanceAfter` computation runs forward from `baseStock`. The `baseStock` is calculated as:

```typescript
const baseStock = currentQty - totalDelta;
```

This is mathematically correct **only if all movements are in the database**. If a movement was deleted or edited externally (e.g., by another tab), the `currentQty` passed in could be stale, making ALL `balanceAfter` values wrong for the entire history.

> [!NOTE]
> In practice this is partially mitigated because `loadMovements` is called with `freshQty` after edits/deletes. But the initial load on line 326 uses `material.current_quantity` from the parent component, which could be stale if stock changed since the parent last loaded.

---

### BUG 7: `Suppliers` total spend includes ALL shipments in the summary card, not just filtered month

**File**: [Suppliers.tsx](file:///d:/inventory/inv-V2/src/pages/Suppliers.tsx#L482)

```typescript
const totalSpend = shipments.reduce((acc, s) => acc + s.quantity * s.unit_price, 0)
```

This calculates total spend across ALL shipments regardless of the selected month filter. The stat card at line 631 just says "Total Spend" which is correct, but users might expect it to reflect the currently viewed month since everything else on the page is filtered by month.

> [!NOTE]
> This is a design ambiguity rather than a strict bug, but it can mislead factory managers reviewing monthly costs.

---

### BUG 8: Packaging balance display shows incorrect values when `packaging_level1_size` is a decimal

**File**: [MaterialDetail.tsx](file:///d:/inventory/inv-V2/src/pages/MaterialDetail.tsx#L476-L500)

```typescript
const level1Count = Math.floor(qty / l1s);
const remainder = Number((qty % l1s).toFixed(2));
```

JavaScript's `%` operator with floating-point numbers produces imprecise results. For example, if `qty = 30000` and `l1s = 6000.5`, the modulo result might be `5999.999...` instead of the correct value.

**Fix**: Compute remainder as `qty - level1Count * l1s` instead of using `%`.

---

### BUG 9: `StockMovementDialog` — OUT validation uses potentially stale `material.current_quantity`

**File**: [StockMovementDialog.tsx](file:///d:/inventory/inv-V2/src/components/StockMovementDialog.tsx#L65-L70)

```typescript
if (type === "OUT" && qty > material!.current_quantity) {
  setError(`Cannot subtract ${qty}...`)
  return
}
```

The `material` object is passed from the parent (`StockStatus`) which loaded it once on mount. If you've been on the page for a while, or if someone else recorded a stock OUT from another tab/device, the `current_quantity` used for validation could be outdated. The user would pass the client check but then hit the DB constraint, getting a cryptic error.

> [!NOTE]
> The DB `CHECK` constraint is the real safety net here, and the app does catch the `current_quantity_non_negative` error at line 87. So this won't corrupt data — it's just a poor UX. But for a factory app used by multiple people, it matters.

---

### BUG 10: `EditShipmentDialog` updates the shipment date as a string but stock_movement date as ISO

**File**: [EditShipmentDialog.tsx](file:///d:/inventory/inv-V2/src/components/EditShipmentDialog.tsx#L68-L97)

```typescript
// Shipment: saves date as the raw input string (e.g., "2026-07-15")
.update({ date, ... })

// Stock movement: converts to ISO (e.g., "2026-07-14T23:00:00.000Z" due to timezone)
.update({ date: new Date(date).toISOString(), ... })
```

> [!WARNING]
> The shipment `date` column is `date` type in Postgres while the stock_movement `date` column is `timestamptz`. When you do `new Date("2026-07-15").toISOString()`, JavaScript creates the date at midnight **UTC**. If your factory is in Algeria (UTC+1), this means the movement's date will be **July 14th at 23:00** in local time — **one day behind** the shipment.
> 
> This causes the movement to appear on a different day than the shipment in the MaterialDetail history, and can even show up in the **wrong month** if edited near month boundaries (e.g., editing a July 1st shipment creates a June 30th movement).

This same bug exists in [NewShipmentDialog.tsx](file:///d:/inventory/inv-V2/src/components/NewShipmentDialog.tsx#L106) at line 106:
```typescript
date: new Date(date).toISOString(),
```

**Fix**: Instead of `new Date(date).toISOString()`, use `date + "T12:00:00"` to avoid timezone boundary issues, or simply pass the date string directly and let Postgres handle the cast.

---

## 🟡 MINOR — Edge cases and data integrity

### BUG 11: `AddMaterialDialog` — Opening stock doesn't wait for the stock movement insert to succeed

**File**: [AddMaterialDialog.tsx](file:///d:/inventory/inv-V2/src/components/AddMaterialDialog.tsx#L130-L137)

```typescript
if (os > 0) {
  await supabase.from("stock_movements").insert({...});
  // ⚠️ No error check on this insert!
}
```

If the stock movement insert fails (e.g., network hiccup), the material is created with `current_quantity: 0` and the opening stock is lost. The user sees a success message and doesn't know the opening balance wasn't recorded.

**Fix**: Check the error from this insert and either show a warning or roll back.

---

### BUG 12: Physical Inventory `écart` sums different units together

**File**: [PhysicalInventory.tsx](file:///d:/inventory/inv-V2/src/pages/PhysicalInventory.tsx#L110)

```typescript
const totalEcart = entries.reduce((acc, e) => acc + (e.theoretical_quantity - e.real_quantity), 0)
```

This sums the écart across ALL materials regardless of unit. If you have 10 kg loss of flour and 500 units loss of bottles, the total shows `510` — which is meaningless since you're adding kg and units together.

> [!NOTE]
> This is a display issue that could confuse factory managers but doesn't affect stock data.

---

## Summary

| # | Severity | Bug | Impact on Stock |
|---|----------|-----|-----------------|
| 1 | 🔴 Critical | Supplier deletion may not delete all movements | Phantom stock remains |
| 2 | 🔴 Critical | Shipment deletion only removes 1 movement | Phantom stock remains |
| 3 | 🔴 Critical | Physical inventory never adjusts stock | Stock drift never corrected |
| 4 | 🔴 Critical | Edit movement: no OUT→negative validation | Cryptic error / bad UX |
| 5 | 🟠 Important | Floating-point in "Stock at start of month" | Shows 100.00000000003 |
| 6 | 🟠 Important | Balance history uses potentially stale qty | Wrong history values |
| 7 | 🟠 Important | Total spend not filtered by month | Misleading stats |
| 8 | 🟠 Important | Packaging `%` operator imprecise | Wrong packaging count |
| 9 | 🟠 Important | OUT validation uses stale quantity | Cryptic DB error |
| 10 | 🟠 Important | Date timezone off-by-one day | Movement on wrong date/month |
| 11 | 🟡 Minor | Opening stock insert not error-checked | Opening balance lost silently |
| 12 | 🟡 Minor | Écart sums different units | Meaningless total |

> [!IMPORTANT]
> **Bug #3 (Physical Inventory)** and **Bug #10 (Timezone date shift)** are the most likely to cause you real-world problems in your factory. Bug #3 means your stock will drift over time with no way to correct it. Bug #10 means your shipments and movements may show on different days in the history.

---

Let me know which bugs you want me to fix — I can tackle them all or just the critical ones.
