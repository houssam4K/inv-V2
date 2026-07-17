import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://svvszplxntpibtenvjhe.supabase.co'
const supabaseKey = 'sb_publishable_Kj7-vLqdDVhaSv2eVcHeJg_2h4RcN8Q'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const name = `test_material_${Date.now()}`
  
  // 1. Create material
  const { data: mat, error: err1 } = await supabase.from('raw_materials').insert({
    name,
    unit_of_measure: 'kg',
    current_quantity: 0
  }).select().single()
  
  if (err1) throw err1
  
  // 2. Add opening balance
  await supabase.from('stock_movements').insert({
    raw_material_id: mat.id,
    movement_type: 'IN',
    quantity: 100,
    note: 'Opening balance'
  })
  
  // 3. Add supplier IN movement
  await supabase.from('stock_movements').insert({
    raw_material_id: mat.id,
    movement_type: 'IN',
    quantity: 50,
    note: 'Supplier'
  })
  
  // 4. Check current_quantity
  const { data: check1 } = await supabase.from('raw_materials').select('current_quantity').eq('id', mat.id).single()
  console.log(`Expected 150, got: ${check1.current_quantity}`)
  
  // 5. Add OUT movement
  await supabase.from('stock_movements').insert({
    raw_material_id: mat.id,
    movement_type: 'OUT',
    quantity: 30,
    note: 'Consumed'
  })
  
  const { data: check2 } = await supabase.from('raw_materials').select('current_quantity').eq('id', mat.id).single()
  console.log(`Expected 120, got: ${check2.current_quantity}`)

  // cleanup
  await supabase.from('raw_materials').delete().eq('id', mat.id)
}

test().catch(console.error)
