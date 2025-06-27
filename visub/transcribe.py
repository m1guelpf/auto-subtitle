import whisperx
import gc
import torch

def word_transcribe(audio_file, model="medium", device="cuda", batch_size=16, compute_type="float16", language="", enable_diarization=False, hf_token=None):
    """
    Transcribe audio file using WhisperX with optional speaker diarization.
    
    Parameters:
    - audio_file: Path to the audio file to transcribe.
    - model: Choose between tiny.en, tiny, base.en, base, small.en, small, medium.en, medium, large-v1, large-v2, large-v3, large, distil-large-v2, distil-medium.en, distil-small.en, distil-large-v3, large-v3-turbo, turbo
    - device: Device to run the model on (e.g., "cuda" or "cpu").
    - batch_size: Batch size for transcription.
    - compute_type: Type of computation (e.g., "float16" or "int8"). Recommended to use "int8" to run on CPU.
    - enable_diarization: Whether to enable speaker diarization.
    - hf_token: HuggingFace token for speaker diarization models.
    
    Returns:
    - result: Transcription result with optional speaker labels.
    """

    if compute_type == "int8" and device != "cpu":
        device = "cpu"


    # 1. Transcribe with original whisper (batched)
    # WhisperX doesn't accept "auto" - use None for auto-detection
    print(f"DEBUG: Received language parameter: '{language}'")
    whisper_language = None if language == "auto" or not language else language
    print(f"DEBUG: Using whisper_language: {whisper_language}")
    model = whisperx.load_model(model, device, compute_type=compute_type, language=whisper_language)

    # save model to local path (optional)
    # model_dir = "/path/"
    # model = whisperx.load_model("large-v2", device, compute_type=compute_type, download_root=model_dir)

    audio = whisperx.load_audio(audio_file)
    result = model.transcribe(audio, batch_size=batch_size)
    # print(result) # before alignment

    # delete model if low on GPU resources
    # import gc; import torch; gc.collect(); torch.cuda.empty_cache(); del model

    # 2. Align whisper output
    model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)

    # print(result["segments"]) # after alignment

    # delete model if low on GPU resources
    gc.collect(); torch.cuda.empty_cache(); del model_a

    # 3. Assign speaker labels (optional)
    print(f"DEBUG: enable_diarization={enable_diarization}, hf_token={'[PRESENT]' if hf_token else '[MISSING]'}")
    if enable_diarization:
        if hf_token:
            try:
                # Correct WhisperX diarization API
                print("Loading speaker diarization pipeline...")
                diarize_model = whisperx.diarize.DiarizationPipeline(use_auth_token=hf_token, device=device)
                
                print("Running speaker diarization...")
                diarize_segments = diarize_model(audio)
                
                print("Assigning speakers to words...")
                result = whisperx.assign_word_speakers(diarize_segments, result)
                
                # Clean up diarization model
                del diarize_model
                gc.collect()
                if device == "cuda":
                    torch.cuda.empty_cache()
                    
                print(f"Speaker diarization completed successfully")
            except Exception as e:
                print(f"Warning: Speaker diarization failed: {e}")
                # Continue without speaker labels
        else:
            # Simulate speaker detection for demo purposes
            print("Warning: No HF token provided, simulating speakers for demo")
            total_duration = result["segments"][-1]["end"] if result["segments"] else 0
            
            # Simulate 2 speakers alternating every ~10 seconds
            for segment in result["segments"]:
                if "words" in segment:
                    for word in segment["words"]:
                        # Alternate speakers based on time
                        speaker_id = "SPEAKER_00" if word["start"] % 20 < 10 else "SPEAKER_01"
                        word["speaker"] = speaker_id
            
            print(f"Simulated 2 speakers for demo purposes")

    return result