import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';

type RootStackParamList = {
  Home: undefined;
  ProfileSetup: { isEditing?: boolean };
};

type ProfileSetupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileSetup'>;
type ProfileSetupScreenRouteProp = RouteProp<RootStackParamList, 'ProfileSetup'>;

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini (fmr. 'Swaziland')", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Holy See", "Honduras", "Hong Kong", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan",
  "Vanuatu", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

const ETHNICITIES = [
  'Asian', 'Black / African', 'Hispanic / Latino', 'White / Caucasian', 
  'Middle Eastern', 'Native American', 'Pacific Islander', 'Mixed', 'Other'
];

const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA' },
  { code: '+44', country: 'UK' },
  { code: '+86', country: 'CN' },
  { code: '+81', country: 'JP' },
  { code: '+852', country: 'HK' },
  { code: '+33', country: 'FR' },
  { code: '+49', country: 'DE' },
  { code: '+61', country: 'AU' },
  { code: '+91', country: 'IN' },
  { code: '+82', country: 'KR' },
  { code: '+55', country: 'BR' },
  { code: '+52', country: 'MX' },
  { code: '+34', country: 'ES' },
  { code: '+39', country: 'IT' },
  { code: '+7', country: 'RU' },
];

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

export default function ProfileSetupScreen() {
  const navigation = useNavigation<ProfileSetupScreenNavigationProp>();
  const route = useRoute<ProfileSetupScreenRouteProp>();
  const isEditing = route.params?.isEditing;

  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  
  // Phone & Verification State
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneInput, setPhoneInput] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Voice Bio State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceBioUri, setVoiceBioUri] = useState<string | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const [image, setImage] = useState<string | null>(null);
  
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [ethnicityModalVisible, setEthnicityModalVisible] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [countryCodeModalVisible, setCountryCodeModalVisible] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (isEditing) {
        try {
          const profileString = await AsyncStorage.getItem('userProfile');
          if (profileString) {
            const profile = JSON.parse(profileString);
            setUserId(profile.id);
            setUsername(profile.username || '');
            // setPassword(profile.password || ''); // Don't pre-fill password for security
            setBio(profile.bio || '');
            setHobbies(profile.hobbies ? (Array.isArray(profile.hobbies) ? profile.hobbies.join(', ') : profile.hobbies) : '');
            setImage(profile.image || null);
            setCountry(profile.location || '');
            setLanguage(profile.language || '');
            setEthnicity(profile.ethnicity || '');
            setGender(profile.gender || '');
            setAge(profile.age ? profile.age.toString() : '');
            setVoiceBioUri(profile.voice_bio || null);
            
            if (profile.phone_number) {
                setIsPhoneVerified(true);
            }
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      }
    };
    loadProfile();
  }, [isEditing]);

  const pickImage = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  }, []);

  const handleSendOtp = useCallback(async () => {
    if (!phoneInput) {
        Alert.alert('Error', 'Please enter a phone number');
        return;
    }
    
    setIsVerifying(true);
    const fullNumber = countryCode + phoneInput;
    const response = await ApiService.sendOtp(fullNumber);
    
    if (response.error) {
        Alert.alert('Error', response.error);
        setIsVerifying(false);
    } else {
        // Show code for demo convenience
        Alert.alert('Success', `Verification code sent! Code: ${response.code}`);
    }
  }, [phoneInput, countryCode]);

  const handleVerifyOtp = useCallback(async () => {
    if (!verificationCode) {
        Alert.alert('Error', 'Please enter the code');
        return;
    }
    
    const fullNumber = countryCode + phoneInput;
    const response = await ApiService.verifyOtp(fullNumber, verificationCode);
    
    if (response.success) {
        setIsPhoneVerified(true);
        setIsVerifying(false);
        Alert.alert('Success', 'Phone verified!');
    } else {
        Alert.alert('Error', 'Invalid code');
    }
  }, [verificationCode, countryCode, phoneInput]);

  async function startRecording() {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
        setRecording(null);
      }

      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
         Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      recordingRef.current = recording;
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    
    const currentRecording = recordingRef.current;
    setRecording(null);
    recordingRef.current = null;

    try {
        await currentRecording.stopAndUnloadAsync();
    } catch (e) {
        console.log('Error stopping recording', e);
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = currentRecording.getURI();
    setVoiceBioUri(uri || null);
  }

  async function playRecording() {
      if (voiceBioUri) {
          try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                setSound(null);
            }

            const { sound } = await Audio.Sound.createAsync({ uri: voiceBioUri });
            setSound(sound);
            soundRef.current = sound;
            await sound.playAsync();
          } catch (error) {
            console.log('Error playing sound', error);
          }
      }
  }

  const deleteRecording = () => {
      setVoiceBioUri(null);
  };

  const handleSave = useCallback(async () => {
    if (!username || !password || !bio || !hobbies || !image || !country || !language || !ethnicity || !gender || !age) {
      Alert.alert('Missing Information', 'Please fill in all fields and upload a profile picture.');
      return;
    }
    // ... (rest of function)


    // Check Phone Verification
    if (phoneInput && !isPhoneVerified) {
        Alert.alert('Verification Required', 'Please verify your phone number before saving.');
        return;
    }
    
    try {
      const userProfile = {
        username,
        password,
        name: username, // Use username as name for now
        age: parseInt(age, 10),
        bio,
        image,
        type: 'date', // Default type
        location: country,
        hobbies: hobbies.split(',').map(h => h.trim()).filter(h => h), // Convert string to array and filter empty
        language,
        ethnicity,
        gender,
        phone_number: phoneInput ? (countryCode + phoneInput) : '',
        voice_bio: voiceBioUri,
      };

      let response;
      if (isEditing && userId) {
        // Update existing user
        response = await ApiService.updateUser(userId, userProfile);
      } else {
        // Create new user
        response = await ApiService.signup(userProfile);
      }
      
      // Save complete profile with ID from backend to AsyncStorage
      const profileToSave = { ...userProfile, id: response.id };
      await AsyncStorage.setItem('userProfile', JSON.stringify(profileToSave));
      
      if (isEditing) {
        navigation.goBack();
      } else {
        navigation.replace('Home');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save profile data. Please try again.');
    }
  }, [username, password, bio, hobbies, image, country, language, ethnicity, gender, age, phoneInput, isPhoneVerified, countryCode, isEditing, userId, navigation]);

  const handleNext = useCallback(() => {
    // Validation for Step 1
    if (step === 1) {
      if (!username || !password) {
        Alert.alert('Missing Information', 'Please fill in username and password.');
        return;
      }
    }
    
    // Validation for Step 2
    if (step === 2) {
      if (!age || !gender || !ethnicity || !country || !language) {
         Alert.alert('Missing Information', 'Please fill in all personal details.');
         return;
      }
      if (phoneInput && !isPhoneVerified) {
         Alert.alert('Verification Required', 'Please verify your phone number.');
         return;
      }
    }

    // Validation for Step 3
    if (step === 3) {
      if (!bio || !hobbies) {
        Alert.alert('Missing Information', 'Please fill in bio and hobbies.');
        return;
      }
    }

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  }, [step, username, password, age, gender, ethnicity, country, language, phoneInput, isPhoneVerified, bio, hobbies, handleSave]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  }, [step, navigation]);

  const renderSelectionModal = useCallback((
    visible: boolean, 
    onClose: () => void, 
    data: string[], 
    onSelect: (item: string) => void,
    title: string
  ) => (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select {title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  ), []);

  const renderStep1 = useCallback(() => (
    <>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Choose a username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Choose a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>
    </>
  ), [username, password]);

  const renderStep2 = useCallback(() => (
    <>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          placeholder="Your age"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Gender</Text>
        <TouchableOpacity 
          style={styles.selector}
          onPress={() => setGenderModalVisible(true)}
        >
          <Text style={gender ? styles.selectorText : styles.placeholderText}>
            {gender || "Select Gender"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Ethnicity</Text>
        <TouchableOpacity 
          style={styles.selector}
          onPress={() => setEthnicityModalVisible(true)}
        >
          <Text style={ethnicity ? styles.selectorText : styles.placeholderText}>
            {ethnicity || "Select Ethnicity"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Country</Text>
        <TouchableOpacity 
          style={styles.selector}
          onPress={() => setCountryModalVisible(true)}
        >
          <Text style={country ? styles.selectorText : styles.placeholderText}>
            {country || "Select Country"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Language</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. English, Spanish"
          value={language}
          onChangeText={setLanguage}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
                style={[styles.input, { width: 80, marginRight: 10, justifyContent: 'center', alignItems: 'center' }]}
                onPress={() => setCountryCodeModalVisible(true)}
            >
                <Text style={{ fontSize: 16 }}>{countryCode}</Text>
            </TouchableOpacity>
            
            <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Number"
                value={phoneInput}
                onChangeText={(text) => {
                    setPhoneInput(text);
                    setIsPhoneVerified(false); // Reset verification on change
                }}
                keyboardType="phone-pad"
            />
            
            <TouchableOpacity 
                style={[styles.button, { marginTop: 0, marginLeft: 10, padding: 15, backgroundColor: isPhoneVerified ? '#4CAF50' : '#E94057' }]}
                onPress={handleSendOtp}
                disabled={isPhoneVerified}
            >
                <Text style={[styles.buttonText, { fontSize: 14 }]}>
                    {isPhoneVerified ? 'Verified' : 'Verify'}
                </Text>
            </TouchableOpacity>
        </View>

        {isVerifying && (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 10 }]}
                    placeholder="Enter Code"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                />
                <TouchableOpacity 
                    style={[styles.button, { marginTop: 0, padding: 15 }]}
                    onPress={handleVerifyOtp}
                >
                    <Text style={[styles.buttonText, { fontSize: 14 }]}>Confirm</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>
    </>
  ), [age, gender, ethnicity, country, language, countryCode, phoneInput, isPhoneVerified, isVerifying, verificationCode, handleSendOtp, handleVerifyOtp]);

  const renderStep3 = useCallback(() => (
    <>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Write a short bio..."
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Voice Bio</Text>
        <View style={styles.voiceContainer}>
            {!voiceBioUri ? (
                <TouchableOpacity 
                    style={[styles.voiceButton, recording ? styles.recordingButton : null]} 
                    onPress={recording ? stopRecording : startRecording}
                >
                    <Ionicons name={recording ? "stop" : "mic"} size={24} color="white" />
                    <Text style={styles.voiceButtonText}>{recording ? "Stop Recording" : "Record Voice Bio"}</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.voiceControls}>
                    <TouchableOpacity style={styles.playButton} onPress={playRecording}>
                        <Ionicons name="play" size={24} color="#E94057" />
                        <Text style={styles.playButtonText}>Play</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={deleteRecording}>
                        <Ionicons name="trash" size={24} color="#666" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Hobbies (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Reading, Hiking, Gaming"
          value={hobbies}
          onChangeText={setHobbies}
        />
      </View>
    </>
  ), [bio, hobbies]);

  const renderStep4 = useCallback(() => (
    <View style={{ alignItems: 'center' }}>
      <Text style={[styles.label, { marginBottom: 20 }]}>Upload a Profile Picture</Text>
      <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Upload Photo</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  ), [image, pickImage]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{isEditing ? 'Edit Profile' : 'Create Profile'}</Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${(step / totalSteps) * 100}%` }]} />
        </View>
        <Text style={styles.stepText}>Step {step} of {totalSteps}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.navButton, styles.backButton]} onPress={handleBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navButton, styles.nextButton]} onPress={handleNext}>
          <Text style={styles.nextButtonText}>{step === totalSteps ? 'Save' : 'Next'}</Text>
        </TouchableOpacity>
      </View>

      {renderSelectionModal(
        countryModalVisible, 
        () => setCountryModalVisible(false), 
        COUNTRIES, 
        setCountry, 
        "Country"
      )}

      {renderSelectionModal(
        ethnicityModalVisible, 
        () => setEthnicityModalVisible(false), 
        ETHNICITIES, 
        setEthnicity, 
        "Ethnicity"
      )}

      {renderSelectionModal(
        genderModalVisible, 
        () => setGenderModalVisible(false), 
        GENDER_OPTIONS, 
        setGender, 
        "Gender"
      )}

      {renderSelectionModal(
        countryCodeModalVisible,
        () => setCountryCodeModalVisible(false),
        COUNTRY_CODES.map(c => `${c.code} (${c.country})`),
        (item) => setCountryCode(item.split(' ')[0]),
        "Country Code"
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scrollContent: {
    padding: 20,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#E94057',
    borderRadius: 3,
  },
  stepText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  navButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    minWidth: 100,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#f0f0f0',
  },
  nextButton: {
    backgroundColor: '#E94057',
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E94057',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  imageContainer: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    color: '#999',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#E94057',
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#E94057',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selector: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    color: '#E94057',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  modalItemText: {
    fontSize: 18,
    color: '#333',
  },
  voiceContainer: {
      marginTop: 10,
      alignItems: 'center',
  },
  voiceButton: {
      flexDirection: 'row',
      backgroundColor: '#E94057',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 25,
      alignItems: 'center',
  },
  recordingButton: {
      backgroundColor: '#FF4444',
  },
  voiceButtonText: {
      color: 'white',
      marginLeft: 10,
      fontWeight: 'bold',
  },
  voiceControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 15,
  },
  playButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF0F3',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
  },
  playButtonText: {
      color: '#E94057',
      marginLeft: 5,
      fontWeight: 'bold',
  },
  deleteButton: {
      padding: 10,
  },
});
