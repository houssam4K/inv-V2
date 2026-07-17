import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://svvszplxntpibtenvjhe.supabase.co'
const supabaseKey = 'sb_publishable_Kj7-vLqdDVhaSv2eVcHeJg_2h4RcN8Q'
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: movements, error } = await supabase.from('stock_movements').select('*, raw_materials(name)')
  if (error) console.error(error)
  else console.log(JSON.stringify(movements, null, 2))
}

main()
