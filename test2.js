import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://svvszplxntpibtenvjhe.supabase.co'
const supabaseKey = 'sb_publishable_Kj7-vLqdDVhaSv2eVcHeJg_2h4RcN8Q'
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: materials } = await supabase.from('raw_materials').select('*').eq('name', 'preform 26G')
  const mat = materials[0]
  
  const { data: movements } = await supabase.from('stock_movements').select('*').eq('raw_material_id', mat.id).order('created_at')
  
  console.log(movements)
}

main()
