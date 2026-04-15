import { supabase } from '../supabase'

export interface NewBugReport {
  description: string
  url: string | null
  userAgent: string | null
  screenshot: File | null
}

const BUCKET = 'bug-screenshots'

// Uploads the optional screenshot to storage and inserts a bug_reports row.
// Identity columns (user_id, user_role) are stamped server-side by a trigger,
// so we don't send them from the client.
export async function createBugReport(input: NewBugReport): Promise<void> {
  let screenshotPath: string | null = null

  if (input.screenshot) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('No active session')

    const extension = input.screenshot.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, input.screenshot, {
        contentType: input.screenshot.type,
        upsert: false,
      })
    if (uploadError) throw uploadError
    screenshotPath = `${BUCKET}/${path}`
  }

  const { error: insertError } = await supabase.from('bug_reports').insert({
    description: input.description,
    url: input.url,
    user_agent: input.userAgent,
    screenshot_url: screenshotPath,
  })
  if (insertError) {
    // If the row insert fails after an upload, leave the orphaned screenshot.
    // Admin can clean up; retrying a report doesn't re-use the file anyway.
    throw insertError
  }
}
