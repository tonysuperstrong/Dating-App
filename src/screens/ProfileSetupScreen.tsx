import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          setUserId(profile.id);
          setUsername(profile.username || '');
          setPassword(profile.password || '');
          setBio(profile.bio || '');
          setHobbies(Array.isArray(profile.hobbies) ? profile.hobbies.join(', ') : (profile.hobbies || ''));
          setCountry(profile.location || profile.country || '');
          setLanguage(profile.language || '');
          setEthnicity(profile.ethnicity || '');
          setGender(profile.gender || '');
          setAge(profile.age?.toString() || '');
          setImage(profile.image || null);
          
          if (profile.phone_number) {
            // Try to parse country code
            const foundCode = COUNTRY_CODES.find(c => profile.phone_number.startsWith(c.code));
            if (foundCode) {
                setCountryCode(foundCode.code);
                setPhoneInput(profile.phone_number.replace(foundCode.code, ''));
            } else {
                setPhoneInput(profile.phone_number);
            }
            setIsPhoneVerified(true); // Assume saved number is verified
          }
        }
      } catch (error) {
        console.error('Failed to load profile', error);
      }
    };
    loadProfile();
  }, []);

  // Modal states
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [ethnicityModalVisible, setEthnicityModalVisible] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [countryCodeModalVisible, setCountryCodeModalVisible] = useState(false);

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSendOtp = async () => {
    if (!phoneInput) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    
    const fullNumber = countryCode + phoneInput;
    const response = await ApiService.sendOtp(fullNumber);
    
    if (response.success) {
        setIsVerifying(true);
        Alert.alert('Code Sent', `Your verification code is: ${response.code}`); // For testing
    } else {
        Alert.alert('Error', response.error || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationCode) return;
    
    const fullNumber = countryCode + phoneInput;
    const response = await ApiService.verifyOtp(fullNumber, verificationCode);
    
    if (response.success) {
        setIsPhoneVerified(true);
        setIsVerifying(false);
        setVerificationCode('');
        Alert.alert('Success', 'Phone number verified!');
    } else {
        Alert.alert('Error', response.error || 'Invalid code');
    }
  };

  const handleSave = async () => {
    if (!username || !password || !bio || !hobbies || !image || !country || !language || !ethnicity || !gender || !age) {
      Alert.alert('Missing Information', 'Please fill in all fields and upload a profile picture.');
      return;
    }

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
  };

  const renderSelectionModal = (
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
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{isEditing ? 'Edit Profile' : 'Create Profile'}</Text>
      <Text style={styles.subtitle}>{isEditing ? 'Update your details' : 'Tell us about yourself!'}</Text>

      <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Upload Photo</Text>
          </View>
        )}
      </TouchableOpacity>

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
        <Text style={styles.label}>Hobbies (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Reading, Hiking, Gaming"
          value={hobbies}
          onChangeText={setHobbies}
        />
      </View>

      {/* Country Selection */}
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

      {/* Ethnicity Selection */}
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

      {/* Gender Selection */}
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

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>{isEditing ? 'Save Changes' : 'Get Started'}</Text>
      </TouchableOpacity>

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

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#fff',
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
    fontSize: 16,
    color: '#333',
  },
});
