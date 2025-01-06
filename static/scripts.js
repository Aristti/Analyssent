document.getElementById('analyze-button').addEventListener('click', function () {
    const inputText = document.getElementById('text-input').value;

    if (!inputText.trim()) {
        alert('Please enter some text to analyze.');
        return;
    }

    // Cacher la section CSV
    document.getElementById('csv-analysis-section').style.display = 'none';

    document.getElementById('loading').style.display = 'block';
    document.getElementById('result-section').style.display = 'none';



    // Send the text to the server
    fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText })
    })
        .then(response => response.json())
        .then(data => {
            // Hide loading animation
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result-section').style.display = 'block';
    
    // Cacher les résultats CSV lors de l'analyse de texte simple
            document.getElementById("csv-results").style.display = "none";
    document.getElementById('back-button').style.display = 'block';



    // Vider le tableau CSV s'il y a des restes
    	   const tableBody = document.querySelector("#csv-results-table tbody");
    	   if (tableBody) {
        	tableBody.innerHTML = "";
   	   }

            // Display the results
            const emojiElement = document.getElementById('emoji');
            emojiElement.src = data.emoji;
            emojiElement.style.display = 'block';

            const audioElement = new Audio(data.audio_file);
            audioElement.play(); // Lecture automatique de l'audio

            document.getElementById('emotion-result').textContent = `Emotion: ${data.emotion} (${data.emotion_score})`;
            document.getElementById('sentiment-result').textContent = `Sentiment: ${data.sentiment}`;
            
            // Ajouter un horodatage pour forcer le rafraîchissement du wordcloud
            const timestamp = new Date().getTime();
            document.getElementById('wordcloud').src = `${data.wordcloud}?${timestamp}`;
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while processing your request. Please try again.');
        });
});

// Variables globales pour les instances des graphiques
let sentimentChartInstance = null;
let emotionChartInstance = null;
document.getElementById("analyze-csv-button").addEventListener("click", function () {
    // Cacher le séparateur entre les sections d'analyse de texte et d'analyse CSV
    const separator = document.querySelector('.section-separator');
    if (separator) {
        separator.style.display = 'none'; // Masquer le séparateur
    }    
    // Afficher le loader
    document.getElementById("loading-csv").style.display = "flex";
    document.getElementById("csv-results").style.display = "none"; // Masquer les résultats précédents
    document.getElementById("result-section").style.display = "none";
    document.getElementById('wordcloud').style.display = "none";
    document.getElementById('sentiment-container').style.display = 'none';
    document.getElementById('emotion-container').style.display = 'none';
    console.log("Analyse CSV commencée, affichage du loader.");

    const fileInput = document.getElementById("input_csv").files[0];
    console.log("Fichier sélectionné :", fileInput);  // Vérification du fichier

    if (!fileInput) {
        alert("Veuillez sélectionner un fichier CSV.");
        document.getElementById("loading-csv").style.display = "none"; // Cacher le loader si pas de fichier
        return;
    }

    // Cacher la section d'analyse de texte
    document.getElementById('text-analysis-section').style.display = 'none';
    document.getElementById('back-button').style.display = 'block';

    const formData = new FormData();
    formData.append("file", fileInput);

    fetch("/upload_csv", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log("Réponse reçue :", data); // Debug
        if (data.error) {
            alert(`Erreur : ${data.error}`);
            document.getElementById("loading-csv").style.display = "none"; // Cacher le loader en cas d'erreur
            return;
        }

        // Traiter les résultats (même logique que vous avez déjà)
        const tableBody = document.querySelector("#csv-results-table tbody");
        if (!tableBody) {
            console.error("Élément tbody introuvable dans le tableau !");
            const table = document.getElementById("csv-results-table");
            tableBody = document.createElement("tbody");
            table.appendChild(tableBody);
        }

        // Réinitialiser et afficher les résultats dans le tableau
        document.getElementById("csv-results").style.display = "block";
        tableBody.innerHTML = ""; // Réinitialiser le tableau

        let sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
        let emotionCounts = {};

        data.results.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.text}</td>
                <td>${row.sentiment}</td>
                <td>${row.emotion}</td>
                <td>${row.emotion_score}</td>
            `;
            tableBody.appendChild(tr);

            sentimentCounts[row.sentiment] = (sentimentCounts[row.sentiment] || 0) + 1;
            emotionCounts[row.emotion] = (emotionCounts[row.emotion] || 0) + 1;
        });

        // Mettre à jour les compteurs
        document.getElementById("total-messages").textContent = data.results.length;
        document.getElementById("positive-sentiment").textContent = sentimentCounts.positive;
        document.getElementById("negative-sentiment").textContent = sentimentCounts.negative;
        document.getElementById("neutral-sentiment").textContent = sentimentCounts.neutral;

        // Afficher les émotions
        const topEmotionsList = document.getElementById("top-emotions");
        topEmotionsList.innerHTML = "";
        Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .forEach(([emotion, count]) => {
                const li = document.createElement("li");
                li.textContent = `${emotion}: ${count}`;
                topEmotionsList.appendChild(li);
            });

        // Détruire et recréer les graphiques
        if (sentimentChartInstance) sentimentChartInstance.destroy();
        if (emotionChartInstance) emotionChartInstance.destroy();

        renderCharts(sentimentCounts, emotionCounts);

        // Cacher le loader une fois l'analyse terminée
        document.getElementById("loading-csv").style.display = "none";        // Ajouter un lien de téléchargement pour le fichier
        const downloadContainer = document.getElementById("download-container");
        if (downloadContainer) {
            const csvDownloadLink = document.createElement("a");
            csvDownloadLink.href = data.file_url;
            csvDownloadLink.download = "results.csv";
            csvDownloadLink.textContent = "Télécharger les résultats CSV";
            csvDownloadLink.style.color = "blue";
            csvDownloadLink.style.textDecoration = "underline";
            downloadContainer.innerHTML = ""; // Effacez les anciens liens
            downloadContainer.appendChild(csvDownloadLink);
	    console.log("Lien de téléchargement généré :", data.file_url);

        } else {
            console.error("Élément #download-container introuvable !");
        }

        
        alert("Analyse du fichier CSV réussie !");
    })
    .catch(error => {
        console.error("Erreur lors de l'analyse CSV :", error);
        alert("Une erreur est survenue pendant l'analyse du fichier CSV.");
        document.getElementById("loading-csv").style.display = "none"; // Cacher le loader en cas d'erreur
    });
});

// Fonction pour créer les graphiques
function renderCharts(sentimentCounts, emotionCounts) {
    document.getElementById("dashboard").style.display = "grid";

    const sentimentChartCtx = document.getElementById("sentiment-chart").getContext("2d");
    sentimentChartInstance = new Chart(sentimentChartCtx, {
        type: 'pie',
        data: {
            labels: ['Positive', 'Negative', 'Neutral'],
            datasets: [{
                data: [sentimentCounts.positive, sentimentCounts.negative, sentimentCounts.neutral],
                backgroundColor: ['#4caf50', '#f44336', '#ffeb3b']
            }]
        }
    });

    const emotionChartCtx = document.getElementById("emotion-chart").getContext("2d");
    emotionChartInstance = new Chart(emotionChartCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(emotionCounts),
            datasets: [{
                data: Object.values(emotionCounts),
                backgroundColor: '#42a5f5'
            }]
        }
    });
}

// Bouton de retour - Réaffiche les sections cachées
document.getElementById('back-button').addEventListener('click', function () {
    document.getElementById('text-analysis-section').style.display = 'block';
    document.getElementById('csv-analysis-section').style.display = 'block';
    document.getElementById('back-button').style.display = 'none';
 
    // Rafraîchir la page
    location.reload();
});
