import os
import uuid
import logging
from datetime import datetime
from flask import render_template, request, jsonify, session
import google.generativeai as genai
from app import app, db
from models import ChatMessage, ChatSession

# Configure Gemini AI
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Initialize the model
model = genai.GenerativeModel('gemini-2.0-flash')

# Luis IA personality prompt
LUIS_PERSONALITY = """
Eres Luis IA, un asistente virtual amigable, confiable e inteligente. 
Tienes una personalidad cálida y profesional. Siempre respondes de manera útil y clara.
Tu objetivo es ayudar a los usuarios con cualquier pregunta o tarea que tengan.
Mantén un tono conversacional pero profesional, y siempre trata de ser lo más útil posible.
"""

@app.route('/')
def index():
    """Render the main chat interface"""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages and return AI responses"""
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        
        if not user_message:
            return jsonify({'error': 'El mensaje no puede estar vacío'}), 400
        
        # Get or create session ID
        session_uuid = session.get('session_uuid')
        if not session_uuid:
            session_uuid = str(uuid.uuid4())
            session['session_uuid'] = session_uuid
            
            # Create new chat session
            chat_session = ChatSession(session_uuid=session_uuid)
            db.session.add(chat_session)
        else:
            # Update last activity
            chat_session = ChatSession.query.filter_by(session_uuid=session_uuid).first()
            if chat_session:
                chat_session.last_activity = datetime.utcnow()
        
        # Save user message
        user_msg = ChatMessage(
            session_id=session_uuid,
            message_type='user',
            content=user_message
        )
        db.session.add(user_msg)
        
        # Get chat history for context
        recent_messages = ChatMessage.query.filter_by(session_id=session_uuid)\
                                          .order_by(ChatMessage.timestamp.desc())\
                                          .limit(10).all()
        
        # Build conversation context
        conversation_history = []
        for msg in reversed(recent_messages):
            if msg.message_type == 'user':
                conversation_history.append(f"Usuario: {msg.content}")
            else:
                conversation_history.append(f"Luis IA: {msg.content}")
        
        # Add current message
        conversation_history.append(f"Usuario: {user_message}")
        context = "\n".join(conversation_history[-6:])  # Last 6 messages for context
        
        # Generate AI response
        prompt = f"{LUIS_PERSONALITY}\n\nConversación:\n{context}\n\nLuis IA:"
        
        response = model.generate_content(prompt)
        ai_response = response.text
        
        # Save AI response
        ai_msg = ChatMessage(
            session_id=session_uuid,
            message_type='assistant',
            content=ai_response
        )
        db.session.add(ai_msg)
        
        # Commit all changes
        db.session.commit()
        
        return jsonify({
            'response': ai_response,
            'session_id': session_uuid
        })
        
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        db.session.rollback()
        return jsonify({
            'error': 'Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.'
        }), 500

@app.route('/api/history')
def get_chat_history():
    """Get chat history for current session"""
    try:
        session_uuid = session.get('session_uuid')
        if not session_uuid:
            return jsonify({'messages': []})
        
        messages = ChatMessage.query.filter_by(session_id=session_uuid)\
                                   .order_by(ChatMessage.timestamp.asc()).all()
        
        return jsonify({
            'messages': [msg.to_dict() for msg in messages]
        })
        
    except Exception as e:
        logging.error(f"Error getting chat history: {str(e)}")
        return jsonify({'error': 'Error al obtener el historial del chat'}), 500

@app.route('/api/new-session', methods=['POST'])
def new_session():
    """Start a new chat session"""
    try:
        # Clear current session
        session.pop('session_uuid', None)
        
        return jsonify({'message': 'Nueva sesión iniciada'})
        
    except Exception as e:
        logging.error(f"Error starting new session: {str(e)}")
        return jsonify({'error': 'Error al iniciar nueva sesión'}), 500
