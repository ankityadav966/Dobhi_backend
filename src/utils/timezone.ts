/**
 * Timezone utilities for Asia/Kolkata (IST) ↔ UTC conversions
 * 
 * Convention:
 * - User inputs time in IST (Asia/Kolkata)
 * - Database stores all times in UTC
 * - API returns times converted back to IST
 * 
 * This ensures:
 * - Consistency across timezones
 * - No ambiguity in stored times
 * - User sees times they select
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Convert IST (user input) to UTC (database storage)
 * 
 * Example:
 * Input: User selects "6:00 PM" (IST)
 * Output: Equivalent UTC time stored in DB
 */
export function convertISTToUTC(istDate: Date): Date {
  // Get the UTC offset for IST
  // IST is UTC+5:30, so to convert IST → UTC, we subtract 5.5 hours
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in ms
  return new Date(istDate.getTime() - istOffsetMs);
}

/**
 * Convert UTC (database storage) to IST (for API response)
 * 
 * Example:
 * Input: UTC time from DB
 * Output: Equivalent IST time for display
 */
export function convertUTCToIST(utcDate: Date): Date {
  // To convert UTC → IST, we add 5.5 hours
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in ms
  return new Date(utcDate.getTime() + istOffsetMs);
}

/**
 * Format time in IST timezone as "08:00 AM"
 * Input: UTC-stored date from database
 * Output: Formatted time string in IST
 */
export function formatTimeIST(utcDate: Date): string {
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  return new Intl.DateTimeFormat('en-US', timeOptions).format(utcDate);
}

/**
 * Format date in IST timezone
 * Input: UTC-stored date from database
 * Output: Formatted date string in IST (e.g., "Mar 22")
 */
export function formatDateIST(utcDate: Date): string {
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: IST_TIMEZONE,
    month: 'short',
    day: 'numeric',
  };
  return new Intl.DateTimeFormat('en-US', dateOptions).format(utcDate);
}

/**
 * Get current time in IST (for comparisons)
 * Returns: Date object representing "now" in IST timezone
 */
export function getNowIST(): Date {
  const now = new Date();
  return convertUTCToIST(now);
}

/**
 * Get today's start (00:00:00) in IST
 * Returns: Date object for midnight IST today
 */
export function getTodayStartIST(): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [month, day, year] = formatter.format(new Date()).split('/');
  const todayStart = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return todayStart;
}

/**
 * Get tomorrow's start (00:00:00) in IST
 * Returns: Date object for midnight IST tomorrow
 */
export function getTomorrowStartIST(): Date {
  const tomorrow = new Date(getTodayStartIST());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/**
 * Compare if two dates are same day in IST timezone
 * Returns: true if both dates fall on same calendar day in IST
 */
export function isSameDayIST(date1: Date, date2: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date1) === formatter.format(date2);
}

/**
 * Get human-readable day label (e.g., "Today", "Tomorrow", "Mar 22")
 * Input: UTC-stored date from database
 * Output: Day label string in IST
 */
export function getDayLabelIST(utcDate: Date): string {
  const nowIST = getNowIST();
  const todayStart = getTodayStartIST();
  const tomorrowStart = getTomorrowStartIST();
  
  // Get start of the booking date in IST
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [month, day, year] = formatter.format(utcDate).split('/');
  const bookingDateStart = new Date(`${year}-${month}-${day}T00:00:00Z`);
  
  // Compare days
  if (bookingDateStart.getTime() === todayStart.getTime()) {
    return 'Today';
  }
  if (bookingDateStart.getTime() === tomorrowStart.getTime()) {
    return 'Tomorrow';
  }
  
  // Format as "Mar 22"
  return formatDateIST(utcDate);
}

/**
 * Get time range label (e.g., "08:00 AM - 10:00 AM")
 * Input: UTC-stored startTime and endTime from database
 * Output: Formatted time range string in IST
 */
export function getTimeRangeIST(utcStartTime: Date, utcEndTime: Date): string {
  const startStr = formatTimeIST(utcStartTime);
  const endStr = formatTimeIST(utcEndTime);
  return `${startStr} - ${endStr}`;
}

/**
 * Validate if a given IST date is in the future
 * Input: IST date to validate
 * Output: true if date is after current IST time
 */
export function isFutureIST(istDate: Date): boolean {
  return istDate > getNowIST();
}

/**
 * Get IST date at specific time (e.g., "6:00 PM" at a given IST date)
 * IMPORTANT: This is used when user inputs a time
 * Input: baseISTDate (date in IST), timeString ("6:00 PM")
 * Output: IST Date object with specified time
 */
export function setTimeIST(baseISTDate: Date, hour: number, minute: number): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [month, day, year] = formatter.format(baseISTDate).split('/');
  
  // Create date at specified time
  const result = new Date(`${year}-${month}-${day}T00:00:00Z`);
  result.setHours(hour, minute, 0, 0);
  
  return result;
}
