// frontend/src/utils/timeFormatter.js

/**
 * Format a date string to Karachi time (12-hour format with AM/PM)
 * IMPORTANT: Backend already stores timestamps in Karachi time (UTC+5)
 * So we should NOT add extra 5 hours in frontend
 */
export const formatKarachiTime = (dateString) => {
  if (!dateString) {
    return {
      date: '',
      time: '',
      ampm: '',
      fullDateTime: '',
      raw: dateString
    };
  }

  try {
    // Create date object - backend sends time already in Karachi time
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      // If invalid date, return the raw string
      return {
        date: dateString,
        time: '',
        ampm: '',
        fullDateTime: dateString,
        raw: dateString
      };
    }

    // Use hours directly - already in Karachi time from backend
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return {
      date: `${day}/${month}/${year}`,
      time: `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`,
      ampm: ampm,
      fullDateTime: `${day}/${month}/${year} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
      raw: dateString,
      isoString: date.toISOString()
    };
  } catch (error) {
    console.error('Error formatting Karachi time:', error);
    return {
      date: dateString,
      time: '',
      ampm: '',
      fullDateTime: dateString,
      raw: dateString
    };
  }
};

/**
 * Format timestamp for display (simplified version)
 */
export const formatTimestamp = (dateString) => {
  if (!dateString) return 'N/A';
  
  const formatted = formatKarachiTime(dateString);
  return formatted.fullDateTime || 'N/A';
};

/**
 * Format only the date part (dd/mm/yyyy)
 */
export const formatDateOnly = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateString;
  }
};

/**
 * Get current Karachi time for display
 * This is for UI display only, not for storing
 */
export const getCurrentKarachiTime = () => {
  const now = new Date();
  
  // Get current UTC time
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  
  // Add Karachi offset (UTC+5 = 5 * 60 * 60 * 1000)
  const karachiTime = new Date(utcTime + (5 * 60 * 60 * 1000));
  
  let hours = karachiTime.getHours();
  const minutes = karachiTime.getMinutes().toString().padStart(2, '0');
  const seconds = karachiTime.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12;
  
  const year = karachiTime.getFullYear();
  const month = (karachiTime.getMonth() + 1).toString().padStart(2, '0');
  const day = karachiTime.getDate().toString().padStart(2, '0');
  
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`,
    ampm: ampm,
    fullDateTime: `${day}/${month}/${year} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
    isoString: karachiTime.toISOString()
  };
};

/**
 * TEST FUNCTION: Check timezone conversion
 */
export const debugTimezone = (dateString) => {
  console.log('=== TIMEZONE DEBUG ===');
  console.log('Input:', dateString);
  
  const date = new Date(dateString);
  console.log('Date object:', date);
  console.log('UTC:', date.toUTCString());
  console.log('ISO:', date.toISOString());
  console.log('Local:', date.toString());
  console.log('Hours (local):', date.getHours());
  console.log('Timezone offset (min):', date.getTimezoneOffset());
  
  const result = formatKarachiTime(dateString);
  console.log('Formatted:', result.fullDateTime);
  console.log('===================\n');
  
  return result;
};
// New utility functions for date validation and parsing
export const isValidDateFormat = (dateString) => {
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(dateString)) return false;
  
  const [day, month, year] = dateString.split('/').map(Number);
  
  // Basic date validation
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // Check for months with 30 days
  if ([4, 6, 9, 11].includes(month) && day > 30) return false;
  
  // Check February
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (day > (isLeapYear ? 29 : 28)) return false;
  }
  
  return true;
};

export const parseCustomDate = (dateString) => {
  if (!isValidDateFormat(dateString)) {
    throw new Error(`Invalid date format: ${dateString}. Use dd/mm/yyyy`);
  }
  
  const [day, month, year] = dateString.split('/').map(Number);
  // Note: month - 1 because JavaScript months are 0-indexed
  return new Date(year, month - 1, day);
};

export const formatDateForInput = (date) => {
  // Format as dd/mm/yyyy
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
export default {
  formatKarachiTime,
  formatTimestamp,
  formatDateOnly,
  getCurrentKarachiTime,
  debugTimezone
};