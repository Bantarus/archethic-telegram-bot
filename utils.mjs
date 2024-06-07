
export function getCurrentTimeFormatted() {
    const now = new Date();
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Europe/Paris'
    };
    return now.toLocaleTimeString('en-US', options);
  }

export function getRemainingTime() {
  const now = new Date();
  
  // Calculate remaining time for the next day
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const minutesToNextDay = Math.ceil((nextMidnight - now) / (1000 * 60));
  
  // Calculate remaining time for the next round (noon and midnight)
  const nextNoon = new Date(now);
  nextNoon.setHours(12, 0, 0, 0);
  if (now.getHours() >= 12) {
    nextNoon.setDate(nextNoon.getDate() + 1);
  }
  const minutesToNextRound = Math.ceil((nextNoon - now) / (1000 * 60));
  const minutesToNextRoundMidnight = minutesToNextDay; // since it resets at midnight as well

  // The next round is either at noon or at midnight, whichever is sooner
  const nextRoundMinutes = Math.min(minutesToNextRound, minutesToNextRoundMidnight);

  // Calculate remaining time for the next turn (every 30 minutes)
  const nextTurn = new Date(now);
  if (now.getMinutes() < 30) {
    nextTurn.setMinutes(30, 0, 0);
  } else {
    nextTurn.setHours(nextTurn.getHours() + 1, 0, 0, 0);
  }
  const minutesToNextTurn = Math.ceil((nextTurn - now) / (1000 * 60));

  // Function to format minutes into HH:MM
  function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  return {
    nextDay: formatMinutes(minutesToNextDay),
    nextRound: formatMinutes(nextRoundMinutes),
    nextTurn: formatMinutes(minutesToNextTurn),
  };
}

  
  