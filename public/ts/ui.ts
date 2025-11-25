export function showLoading(): void {
  const infoElement = document.getElementById('info');
  if (infoElement) {
    infoElement.innerHTML = 'Identification du pays <div class="loading"></div>';
  }
}

export function showInfo(locationName: string, details: string[], lat: number, lon: number): void {
  const info = `
    <div class="country">${locationName}</div>
    <div>${details.join('<br>')}</div>
    <div><small>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</small></div>
  `;
  const infoElement = document.getElementById('info');
  if (infoElement) {
    infoElement.innerHTML = info;
  }
}

export function showError(message: string): void {
  const infoElement = document.getElementById('info');
  if (infoElement) {
    infoElement.innerHTML = `Erreur: ${message}`;
  }
}

export function speakText(text: string): void {
  if (!window.speechSynthesis) return;
  
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch(e) {
    console.error('Speech error:', e);
  }
}
