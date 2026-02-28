import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Storage adapter ──────────────────────────────────────────────────────────
// Replaces window.storage from the Claude artifact environment.
// All keys already contain the username prefix (e.g. "u-emma-sessions-math")
// so we just store them as-is in a flat kv_store table.

export const storage = {
  async get(key) {
    try {
      const { data, error } = await supabase
        .from('kv_store')
        .select('value')
        .eq('key', key)
        .maybeSingle()
      if (error) { console.error('storage.get error', error); return null; }
      return data ? { value: data.value } : null
    } catch (e) {
      console.error('storage.get exception', e)
      return null
    }
  },

  async set(key, value) {
    try {
      const { error } = await supabase
        .from('kv_store')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (error) { console.error('storage.set error', error); return null; }
      return { key, value }
    } catch (e) {
      console.error('storage.set exception', e)
      return null
    }
  },

  async delete(key) {
    try {
      const { error } = await supabase
        .from('kv_store')
        .delete()
        .eq('key', key)
      if (error) { console.error('storage.delete error', error); return null; }
      return { key, deleted: true }
    } catch (e) {
      console.error('storage.delete exception', e)
      return null
    }
  },
}
