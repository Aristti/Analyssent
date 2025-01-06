from flask import Flask, request, jsonify, render_template, send_file
from keras.models import load_model
from keras.preprocessing.sequence import pad_sequences
from transformers import pipeline
from googletrans import Translator
from wordcloud import WordCloud
import pickle
import pandas as pd
import os
import time


app = Flask(__name__)

# Charger les modèles et outils
sentiment_model = load_model('models/sentiment_model.h5')

with open('models/tokenizer.pkl', 'rb') as f:
    tokenizer = pickle.load(f)
with open('models/label_encoder.pkl', 'rb') as f:
    label_encoder = pickle.load(f)

emotion_analyzer = pipeline('text-classification', model='j-hartmann/emotion-english-distilroberta-base', return_all_scores=True)
translator = Translator()

# Fonctions auxiliaires
def translate_to_english(text):
    translation = translator.translate(text, src='auto', dest='en')
    return translation.text

def analyze_sentiment(text):
    text_in_english = translate_to_english(text)
    seq = tokenizer.texts_to_sequences([text_in_english])
    padded_seq = pad_sequences(seq, maxlen=100)
    predictions = sentiment_model.predict(padded_seq)
    predicted_class = predictions.argmax(axis=-1)
    sentiment_label = label_encoder.inverse_transform(predicted_class)
    return sentiment_label[0]

def analyze_emotion(text):
    text_in_english = translate_to_english(text)
    emotion_scores = emotion_analyzer(text_in_english)
    top_emotion = max(emotion_scores[0], key=lambda x: x['score'])
    return top_emotion['label'], top_emotion['score']

def generate_wordcloud(text):
    try:
        if not text.strip():  # Si le texte est vide
            # Générer un wordcloud vide
            wordcloud = WordCloud(width=800, height=400, background_color='white').generate("Aucun texte fourni")
        else:
            wordcloud = WordCloud(width=800, height=400, background_color='white').generate(text)
        
        wordcloud.to_file("static/wordcloud.png")
        return True  # Indique que le wordcloud a été généré
    except ValueError:  # Si le texte n'a aucun mot valide
        wordcloud = WordCloud(width=800, height=400, background_color='white').generate("Aucun texte valide")
        wordcloud.to_file("static/wordcloud.png")
        return True



def get_audio_and_emoji(sentiment, emotion):
    audio_map = {
        'positive': 'static/audio/positive.mp3',
        'negative': 'static/audio/negative.mp3',
        'neutral': 'static/audio/neutral.mp3'
    }

    emoji_map = {
        'joy': 'static/emojis/joy.gif',
        'anger': 'static/emojis/anger.gif',
        'sadness': 'static/emojis/sadness.gif',
        'fear': 'static/emojis/fear.gif',
        'surprise': 'static/emojis/surprise.gif',
        'disgust': 'static/emojis/disgust.gif'
    }

    audio_file = audio_map.get(sentiment, 'static/audio/neutral.mp3')
    emoji = emoji_map.get(emotion, 'static/emojis/neutral.gif')

    return audio_file, emoji

def process_csv(file_path):
    df = pd.read_csv(file_path)
    if 'text' not in df.columns:
        raise ValueError("CSV file must contain a 'text' column.")

    results = []
    for text in df['text']:
        sentiment = analyze_sentiment(text)
        emotion, emotion_score = analyze_emotion(text)
        results.append({
            'text': text,
            'sentiment': sentiment,
            'emotion': emotion,
            'emotion_score': round(emotion_score, 2)
        })

    results_df = pd.DataFrame(results)
    output_path = os.path.join("static", "results.csv")
    results_df.to_csv(output_path, index=False)
    return output_path

def summarize_results(results):
    sentiments = [row['sentiment'] for row in results]
    emotions = [row['emotion'] for row in results]

    summary = {
        'total_messages': len(results),
        'sentiments': {
            'positive': sentiments.count('positive'),
            'negative': sentiments.count('negative'),
            'neutral': sentiments.count('neutral'),
        },
        'emotions': pd.Series(emotions).value_counts().to_dict()
    }
    return summary

# Routes Flask
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    text = request.json.get('text', '')

    sentiment = analyze_sentiment(text)
    emotion, emotion_score = analyze_emotion(text)
    generate_wordcloud(text)
    audio_file, emoji = get_audio_and_emoji(sentiment, emotion)

    return jsonify({
        'sentiment': sentiment,
        'emotion': emotion,
        'emotion_score': round(emotion_score, 2),
        'wordcloud': '/static/wordcloud.png',
        'audio_file': audio_file,
        'emoji': emoji
    })

import logging
logging.basicConfig(level=logging.INFO)

@app.route('/upload_csv', methods=['POST'])
def upload_csv():
    app.logger.info("Requête reçue pour /upload_csv")
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Aucun fichier fourni.'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Aucun fichier sélectionné.'}), 400

        file_path = os.path.join("uploads", file.filename)
        file.save(file_path)

        output_csv = process_csv(file_path)  # Processus d'analyse
        app.logger.info(f"Fichier de résultats généré : {output_csv}")

        # Charger les résultats en DataFrame
        results_df = pd.read_csv(output_csv)
        results_list = results_df.to_dict(orient='records')  # Convertir en liste de dictionnaires
        summary = summarize_results(results_list)
        app.logger.info(f"Résultats analysés : {results_list}")

        response = {
            'success': True,
            'results': results_list,
            'file_url': f'/static/results.csv?{int(time.time())}',
            'summary':summary
        }
        app.logger.info(f"Réponse retournée : {response}")
        return jsonify(response)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f"Erreur serveur : {str(e)}"}), 500

@app.route('/download_csv', methods=['GET'])
def download_csv():
    file_path = "static/results.csv"
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    else:
        return jsonify({'error': 'No results file available'}), 404

if __name__ == '__main__':
    app.run(debug=True)
