import { useState } from "react";
import { View, Text, TextInput, Pressable, Modal, SafeAreaView, TouchableOpacity, Alert } from "react-native";
import { Audio } from "expo-av";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { getValidatedPublicEnv } from "../utils/env";
import { netFetch } from "../utils/net";

async function submitJournal(userId: string, entryText?: string, entryAudioUri?: string | null) {
  const { data, error: insertErr } = await supabase
    .from("journal_entries")
    .insert([{ user_id: userId, entry_text: entryText || null, entry_audio_url: entryAudioUri || null }])
    .select("id")
    .single();
  if (insertErr) throw insertErr;

  const apiBase = getValidatedPublicEnv("EXPO_PUBLIC_API_URL");
  if (!apiBase) throw new Error("Missing EXPO_PUBLIC_API_URL");

  const resp = await netFetch(`${apiBase}/aiPrompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, entry: entryText || entryAudioUri }),
  });
  const { moodScore, followUp } = await resp.json();

  await supabase
    .from("journal_entries")
    .update({ mood_score: moodScore, follow_up: followUp })
    .eq("id", data.id);

  return followUp;
}

export default function JournalScreen({ navigation }: any) {
  const [textEntry, setTextEntry] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"Text" | "Voice">("Text");
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [followUpPrompt, setFollowUpPrompt] = useState("How can we improve your experience?");

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecordedUri(uri);
  }

  const onSubmit = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) throw new Error("Not signed in");
      const prompt = await submitJournal(user.id, activeTab === "Text" ? textEntry : undefined, activeTab === "Voice" ? recordedUri : undefined);
      setFollowUpPrompt(prompt);
      setModalVisible(true);
    } catch (e) {
      Alert.alert("Error", "Failed to submit. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100 p-6">
      <View className="flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold">Journal</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={{ opacity: loading ? 0.5 : 1 }}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-8 bg-white/95 rounded-2xl shadow-md w-full self-center h-72" style={{ width: "95%", shadowColor: "rgba(0,0,0,0.12)", shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, shadowOpacity: 1 }}>
        <View className="flex-row justify-around pt-4">
          <Pressable onPress={() => setActiveTab("Text")} className="pb-2 border-b-2" style={{ borderBottomColor: activeTab === "Text" ? "green" : "transparent" }}>
            <Text>Text</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab("Voice")} className="pb-2 border-b-2" style={{ borderBottomColor: activeTab === "Voice" ? "green" : "transparent" }}>
            <Text>Voice</Text>
          </Pressable>
        </View>

        {activeTab === "Text" ? (
          <TextInput multiline placeholder="How are you feeling today?" value={textEntry} onChangeText={setTextEntry} className="p-4 h-48" />
        ) : (
          <View className="items-center justify-center h-48">
            <Pressable onPress={isRecording ? stopRecording : startRecording} className="w-16 h-16 bg-green-500 rounded-full items-center justify-center">
              <Feather name="mic" size={32} color="white" />
            </Pressable>
            <Text style={{ marginTop: 8 }}>{isRecording ? "Recording..." : recordedUri ? "Recorded" : "Tap to record"}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={(!textEntry && !recordedUri) || loading}
        className="absolute bottom-10 self-center w-full h-12 rounded-xl justify-center items-center"
        style={{ backgroundColor: !textEntry && !recordedUri ? "grey" : "#FFC773", width: "90%", opacity: loading ? 0.6 : 1 }}
      >
        <Text className="text-white font-semibold text-base">Submit Entry</Text>
      </TouchableOpacity>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="w-3/4 bg-white rounded-2xl p-6 items-center shadow-lg" style={{ width: 300 }}>
            <Text className="text-lg font-bold mb-4">Quick Question</Text>
            <Text className="text-center mb-6">{followUpPrompt}</Text>
            <View className="flex-row justify-between w-full">
              <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-orange-400 px-4 py-2 rounded-lg">
                <Text className="text-white">Answer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="border border-gray-300 px-4 py-2 rounded-lg">
                <Text>Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
