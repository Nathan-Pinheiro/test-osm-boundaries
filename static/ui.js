function showLoading() {
  document.getElementById('info').innerHTML = 'Identification du pays <div class="loading"></div>';
}

function showInfo(locationName, details, lat, lon) {
  const info = `
    <div class="country">${locationName}</div>
    <div>${details.join('<br>')}</div>
    <div><small>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}</small></div>
  `;
  document.getElementById('info').innerHTML = info;
}

function showError(message) {
  document.getElementById('info').innerHTML = `Erreur: ${message}`;
}

function speakText(text) {
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
