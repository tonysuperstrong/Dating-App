import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, 
    TextInput, Image, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../services/ApiService';

const TRIVIA_QUESTIONS = [
    {
        id: '1',
        question: 'Which country won the first ever World Cup in 1930?',
        options: ['Brazil', 'Uruguay', 'Italy', 'Argentina'],
        correctAnswer: 'Uruguay'
    },
    {
        id: '2',
        question: 'What is the most popular dating app by user count in 2024?',
        options: ['Tinder', 'Bumble', 'Hinge', 'Grindr'],
        correctAnswer: 'Tinder'
    },
    {
        id: '3',
        question: 'How long is a standard basketball game in the NBA?',
        options: ['40 minutes', '48 minutes', '60 minutes', '90 minutes'],
        correctAnswer: '48 minutes'
    },
    {
        id: '4',
        question: 'Who holds the record for the most Grand Slam titles in men\'s tennis?',
        options: ['Roger Federer', 'Rafael Nadal', 'Novak Djokovic', 'Pete Sampras'],
        correctAnswer: 'Novak Djokovic'
    },
    {
        id: '5',
        question: 'What is the "love hormone" released during physical touch?',
        options: ['Dopamine', 'Serotonin', 'Oxytocin', 'Adrenaline'],
        correctAnswer: 'Oxytocin'
    }
];

export default function ActivityScreen() {
    const [userId, setUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'activity' | 'notifications'>('activity');
    
    // Data State
    const [dailyTopic, setDailyTopic] = useState<any>(null);
    const [polls, setPolls] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    
    // Create Poll State
    const [modalVisible, setModalVisible] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState(['', '']);

    // Trivia State
    const [triviaModalVisible, setTriviaModalVisible] = useState(false);
    const [currentTriviaIndex, setCurrentTriviaIndex] = useState(0);
    const [triviaScore, setTriviaScore] = useState(0);
    const [selectedTriviaOption, setSelectedTriviaOption] = useState<string | null>(null);
    const [isTriviaAnswered, setIsTriviaAnswered] = useState(false);
    const [showTriviaResult, setShowTriviaResult] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const profileStr = await AsyncStorage.getItem('userProfile');
            if (profileStr) {
                const profile = JSON.parse(profileStr);
                setUserId(profile.id);
                
                // Load Daily Topic
                const topicData = await ApiService.getDailyTopic(profile.id);
                if (topicData) {
                    setDailyTopic(topicData);
                }

                // Load User Polls
                const pollsData = await ApiService.getPolls(profile.id);
                setPolls(pollsData);

                // Load Notifications
                const notifs = await ApiService.getNotifications(profile.id);
                setNotifications(notifs);
            }
        } catch (error) {
            // Failed to load activity data
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // Mark notifications as read when tab is opened
    useEffect(() => {
        if (activeTab === 'notifications' && userId) {
            const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
            if (unreadIds.length > 0) {
                // Optimistic update
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                ApiService.markNotificationsRead(userId);
            }
        }
    }, [activeTab, userId]);

    const handleVoteDaily = useCallback(async (choice: string) => {
        if (!userId || !dailyTopic?.topic) return;
        
        // Optimistic Update
        setDailyTopic((prev: any) => ({
            ...prev,
            userVote: choice,
            voteCounts: {
                ...prev.voteCounts,
                [choice]: (prev.voteCounts[choice] || 0) + 1
            },
            totalVotes: prev.totalVotes + 1
        }));

        await ApiService.voteDailyTopic(userId, dailyTopic.topic.id, choice);
        loadData(); // Refresh to ensure sync
    }, [userId, dailyTopic]);

    const handleVotePoll = useCallback(async (pollId: string, choice: string) => {
        if (!userId) return;

        // Optimistic Update
        setPolls(currentPolls => 
            currentPolls.map(poll => {
                if (poll.id === pollId) {
                    return {
                        ...poll,
                        userVote: choice,
                        voteCounts: {
                            ...poll.voteCounts,
                            [choice]: (poll.voteCounts[choice] || 0) + 1
                        },
                        totalVotes: poll.totalVotes + 1
                    };
                }
                return poll;
            })
        );

        await ApiService.votePoll(userId, pollId, choice);
        loadData();
    }, [userId]);

    const handleCreatePoll = useCallback(async () => {
        if (!userId || !newQuestion.trim() || newOptions.some(o => !o.trim())) {
            Alert.alert('Error', 'Please fill in question and all options');
            return;
        }

        await ApiService.createPoll(userId, newQuestion, newOptions);
        setModalVisible(false);
        setNewQuestion('');
        setNewOptions(['', '']);
        loadData();
    }, [userId, newQuestion, newOptions]);

    const handleAddOption = useCallback(() => {
        if (newOptions.length < 4) {
            setNewOptions([...newOptions, '']);
        }
    }, [newOptions]);

    const handleOptionChange = useCallback((text: string, index: number) => {
        const updated = [...newOptions];
        updated[index] = text;
        setNewOptions(updated);
    }, [newOptions]);

    const handleTriviaAnswer = useCallback((option: string) => {
        if (isTriviaAnswered) return;

        setSelectedTriviaOption(option);
        setIsTriviaAnswered(true);

        const currentQuestion = TRIVIA_QUESTIONS[currentTriviaIndex];
        if (option === currentQuestion.correctAnswer) {
            setTriviaScore(prev => prev + 1);
        }

        setTimeout(() => {
            if (currentTriviaIndex < TRIVIA_QUESTIONS.length - 1) {
                setCurrentTriviaIndex(prev => prev + 1);
                setSelectedTriviaOption(null);
                setIsTriviaAnswered(false);
            } else {
                setShowTriviaResult(true);
            }
        }, 1500);
    }, [isTriviaAnswered, currentTriviaIndex]);

    const resetTrivia = useCallback(() => {
        setCurrentTriviaIndex(0);
        setTriviaScore(0);
        setSelectedTriviaOption(null);
        setIsTriviaAnswered(false);
        setShowTriviaResult(false);
        setTriviaModalVisible(true);
    }, []);

    const renderTriviaCard = useCallback(() => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>🧠 Daily Trivia</Text>
            </View>
            <Text style={styles.question}>Test your knowledge with today's questions!</Text>
            <TouchableOpacity 
                style={styles.playButton}
                onPress={resetTrivia}
            >
                <Text style={styles.playButtonText}>Play Trivia</Text>
            </TouchableOpacity>
        </View>
    ), [resetTrivia]);

    const renderDailyTopic = useCallback(() => {
        if (!dailyTopic?.topic) return null;
        const { topic, userVote, voteCounts, totalVotes } = dailyTopic;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardLabel}>🔥 Today's Topic</Text>
                    <Text style={styles.cardDate}>{new Date(topic.date).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.question}>{topic.question}</Text>
                
                <View style={styles.optionsContainer}>
                    {topic.options.map((option: string) => {
                        const isSelected = userVote === option;
                        const count = voteCounts[option] || 0;
                        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        
                        return (
                            <TouchableOpacity 
                                key={option} 
                                style={[styles.optionButton, isSelected && styles.optionSelected]}
                                onPress={() => handleVoteDaily(option)}
                                disabled={!!userVote}
                            >
                                <View style={styles.optionContent}>
                                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                                    {userVote && <Text style={styles.optionPercent}>{percentage}%</Text>}
                                </View>
                                {userVote && (
                                    <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={styles.metaText}>{totalVotes} votes • {topic.category}</Text>
            </View>
        );
    }, [dailyTopic, handleVoteDaily]);

    const renderPollItem = useCallback(({ item }: { item: any }) => {
        const hasUserImage = !!item.user_image;
        return (
            <View style={styles.card}>
                <View style={styles.userHeader}>
                    {hasUserImage ? (
                        <Image source={{ uri: item.user_image }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase()}</Text>
                        </View>
                    )}
                    <View>
                        <Text style={styles.username}>{item.name || item.username}</Text>
                        <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleDateString()}</Text>
                    </View>
                </View>

                <Text style={styles.question}>{item.question}</Text>

                <View style={styles.optionsContainer}>
                    {item.options.map((option: string) => {
                        const isSelected = item.userVote === option;
                        const count = item.voteCounts[option] || 0;
                        const percentage = item.totalVotes > 0 ? Math.round((count / item.totalVotes) * 100) : 0;

                        return (
                            <TouchableOpacity 
                                key={option}
                                style={[styles.optionButton, isSelected && styles.optionSelected]}
                                onPress={() => handleVotePoll(item.id, option)}
                                disabled={!!item.userVote}
                            >
                                <View style={styles.optionContent}>
                                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                                    {item.userVote && <Text style={styles.optionPercent}>{percentage}%</Text>}
                                </View>
                                {item.userVote && (
                                    <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={styles.metaText}>{item.totalVotes} votes</Text>
            </View>
        );
    }, [handleVotePoll]);

    const renderNotificationItem = useCallback(({ item }: { item: any }) => (
        <View style={[styles.notifItem, !item.is_read && styles.notifUnread]}>
            {item.actor_image ? (
                <Image source={{ uri: item.actor_image }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>?</Text>
                </View>
            )}
            <View style={{flex: 1, marginLeft: 10}}>
                <Text style={styles.notifText}>
                    <Text style={{fontWeight: 'bold'}}>{item.username || 'Someone'}</Text> {item.text}
                </Text>
                <Text style={styles.timestamp}>{new Date(Number(item.timestamp)).toLocaleDateString()}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
        </View>
    ), []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Activity</Text>
                <TouchableOpacity onPress={() => setActiveTab(activeTab === 'activity' ? 'notifications' : 'activity')}>
                    <Ionicons 
                        name={activeTab === 'notifications' ? "notifications" : "notifications-outline"} 
                        size={24} 
                        color="#E94057" 
                    />
                    {notifications.some(n => !n.is_read) && <View style={styles.badge} />}
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'activity' ? (
                <FlatList
                    data={polls}
                    keyExtractor={item => item.id}
                    renderItem={renderPollItem}
                    ListHeaderComponent={() => (
                        <>
                            {renderDailyTopic()}
                            {renderTriviaCard()}
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Community Polls</Text>
                                <TouchableOpacity onPress={() => setModalVisible(true)}>
                                    <Text style={styles.createLink}>+ Create Poll</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    renderItem={renderNotificationItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
                />
            )}

            {/* Create Poll Modal */}
            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Create Poll</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Text style={styles.closeText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView style={styles.modalContent}>
                        <Text style={styles.inputLabel}>Question</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ask the community..."
                            value={newQuestion}
                            onChangeText={setNewQuestion}
                        />

                        <Text style={styles.inputLabel}>Options</Text>
                        {newOptions.map((opt, index) => (
                            <TextInput
                                key={index}
                                style={styles.input}
                                placeholder={`Option ${index + 1}`}
                                value={opt}
                                onChangeText={(text) => handleOptionChange(text, index)}
                            />
                        ))}
                        
                        {newOptions.length < 4 && (
                            <TouchableOpacity onPress={handleAddOption} style={styles.addOptionButton}>
                                <Text style={styles.addOptionText}>+ Add Option</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.submitButton} onPress={handleCreatePoll}>
                            <Text style={styles.submitButtonText}>Post Poll</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* Trivia Modal */}
            <Modal visible={triviaModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Daily Trivia</Text>
                        <TouchableOpacity onPress={() => setTriviaModalVisible(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.modalContent}>
                        {!showTriviaResult ? (
                            <>
                                <View style={styles.progressContainer}>
                                    <Text style={styles.progressText}>Question {currentTriviaIndex + 1} of {TRIVIA_QUESTIONS.length}</Text>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: `${((currentTriviaIndex + 1) / TRIVIA_QUESTIONS.length) * 100}%` }]} />
                                    </View>
                                </View>

                                <Text style={styles.triviaQuestion}>{TRIVIA_QUESTIONS[currentTriviaIndex].question}</Text>

                                <View style={styles.optionsContainer}>
                                    {TRIVIA_QUESTIONS[currentTriviaIndex].options.map((option, index) => {
                                        const isSelected = selectedTriviaOption === option;
                                        const isCorrect = option === TRIVIA_QUESTIONS[currentTriviaIndex].correctAnswer;
                                        
                                        let buttonStyle: any = styles.optionButton;
                                        let textStyle: any = styles.optionText;

                                        if (isTriviaAnswered) {
                                            if (isCorrect) {
                                                buttonStyle = styles.optionButtonCorrect;
                                                textStyle = styles.optionTextSelected;
                                            } else if (isSelected) {
                                                buttonStyle = styles.optionButtonWrong;
                                                textStyle = styles.optionTextSelected;
                                            }
                                        }

                                        return (
                                            <TouchableOpacity 
                                                key={index}
                                                style={[buttonStyle, {marginBottom: 10}]}
                                                onPress={() => handleTriviaAnswer(option)}
                                                disabled={isTriviaAnswered}
                                            >
                                                <Text style={textStyle}>{option}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </>
                        ) : (
                            <View style={styles.resultContainer}>
                                <Text style={styles.resultTitle}>Quiz Complete!</Text>
                                <Text style={styles.resultScore}>You scored {triviaScore} / {TRIVIA_QUESTIONS.length}</Text>
                                <Text style={styles.resultMessage}>
                                    {triviaScore === TRIVIA_QUESTIONS.length ? 'Perfect Score! 🏆' : 
                                     triviaScore > TRIVIA_QUESTIONS.length / 2 ? 'Great Job! 👏' : 'Keep Learning! 📚'}
                                </Text>
                                <TouchableOpacity style={styles.playButton} onPress={() => setTriviaModalVisible(false)}>
                                    <Text style={styles.playButtonText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    listContent: {
        padding: 15,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    cardLabel: {
        color: '#E94057',
        fontWeight: 'bold',
        fontSize: 14,
    },
    cardDate: {
        color: '#999',
        fontSize: 12,
    },
    question: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    optionsContainer: {
        gap: 10,
    },
    optionButton: {
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        padding: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    optionSelected: {
        backgroundColor: '#E94057',
    },
    optionContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 2,
    },
    optionText: {
        fontSize: 15,
        color: '#333',
    },
    optionTextSelected: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    optionPercent: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    progressBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.05)',
        zIndex: 1,
    },
    metaText: {
        marginTop: 10,
        fontSize: 12,
        color: '#999',
        textAlign: 'right',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    createLink: {
        color: '#E94057',
        fontWeight: 'bold',
        fontSize: 16,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    avatarPlaceholder: {
        backgroundColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#555',
    },
    username: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#333',
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E94057',
        borderWidth: 1,
        borderColor: '#fff',
    },
    notifItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    notifUnread: {
        backgroundColor: '#fff0f3',
    },
    notifText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 4,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E94057',
        marginLeft: 10,
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 50,
        fontSize: 16,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeText: {
        color: '#E94057',
        fontSize: 16,
    },
    modalContent: {
        padding: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        marginBottom: 10,
    },
    addOptionButton: {
        marginTop: 10,
        padding: 10,
    },
    addOptionText: {
        color: '#E94057',
        fontWeight: 'bold',
    },
    submitButton: {
        backgroundColor: '#E94057',
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 50,
    },
    submitButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    playButton: {
        backgroundColor: '#E94057',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    playButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    triviaQuestion: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 30,
        textAlign: 'center',
    },
    optionButtonCorrect: {
        backgroundColor: '#4CAF50',
        borderRadius: 10,
        padding: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    optionButtonWrong: {
        backgroundColor: '#FF5252',
        borderRadius: 10,
        padding: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    progressContainer: {
        marginBottom: 20,
    },
    progressText: {
        color: '#999',
        fontSize: 12,
        marginBottom: 5,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#f0f0f0',
        borderRadius: 3,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#E94057',
        borderRadius: 3,
    },
    resultContainer: {
        alignItems: 'center',
        paddingTop: 50,
    },
    resultTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    resultScore: {
        fontSize: 24,
        color: '#E94057',
        fontWeight: 'bold',
        marginBottom: 20,
    },
    resultMessage: {
        fontSize: 18,
        color: '#666',
        marginBottom: 40,
    },
});
