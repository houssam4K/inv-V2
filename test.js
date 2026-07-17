import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://svvszplxntpibtenvjhe.supabase.co'
const supabaseKey = 'sb_publishable_Kj7-vLqdDVhaSv2eVcHeJg_2h4RcN8Q'
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: materials, error: err1 } = await supabase.from('raw_materials').select('*')
  if (err1) {
    console.error(err1)
    return
  }
  
  const { data: movements, error: err2 } = await supabase.from('stock_movements').select('*')
  if (err2) {
    console.error(err2)
    return
  }

  console.log('--- Raw Materials ---')
  materials.forEach(m => {
    const movs = movements.filter(mov => mov.raw_material_id === m.id)
    const inSum = movs.filter(mov => mov.movement_type === 'IN').reduce((acc, mov) => acc + mov.quantity, 0)
    const outSum = movs.filter(mov => mov.movement_type === 'OUT').reduce((acc, mov) => acc + mov.quantity, 0)
    const diff = inSum - outSum
    console.log(`${m.name}: current_quantity = ${m.current_quantity}, movements net = ${diff} (IN: ${inSum}, OUT: ${outSum})`)
  })
}

main()
