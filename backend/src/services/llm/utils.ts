import { jsonrepair } from "jsonrepair";

export interface ParsedJSONResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: string;
}

/**
 * Enhanced JSON parsing with repair capabilities for LLM responses
 * Handles common LLM response patterns like code blocks, extra text, and malformed JSON
 */
export function parseStructuredLLMResponse<T = any>(
  response: string,
  fallbackData?: Partial<T>
): ParsedJSONResult<T> {
  const originalResponse = response;

  try {
    // Step 1: Clean up the response
    let cleanResponse = response.trim();

    // Remove markdown code blocks if present
    if (cleanResponse.startsWith("```")) {
      const jsonMatch = cleanResponse.match(
        /```(?:json)?\s*({[\s\S]*?})\s*```/
      );
      if (jsonMatch) {
        cleanResponse = jsonMatch[1];
      }
    }

    // Extract JSON object from response (handles cases where LLM adds extra text)
    const jsonMatch = cleanResponse.match(/{[\s\S]*}/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[0];
    }

    // Step 2: Try parsing the cleaned response directly
    try {
      const parsed = JSON.parse(cleanResponse);
      return {
        success: true,
        data: parsed,
        rawResponse: originalResponse,
      };
    } catch (parseError) {
      // Step 3: If direct parsing fails, try jsonrepair
      console.log(`🔧 [JSON-REPAIR] Attempting to repair JSON: ${parseError}`);

      const repairedJson = jsonrepair(cleanResponse);
      const parsed = JSON.parse(repairedJson);

      console.log(`✅ [JSON-REPAIR] Successfully repaired and parsed JSON`);

      return {
        success: true,
        data: parsed,
        rawResponse: originalResponse,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown parsing error";

    console.warn(
      `❌ [JSON-PARSE] Failed to parse JSON response: ${errorMessage}`
    );
    console.warn(`📝 [JSON-PARSE] Raw response: ${originalResponse}`);

    // Step 4: Return fallback data if available
    if (fallbackData) {
      console.log(`🔄 [JSON-PARSE] Using fallback data`);
      return {
        success: false,
        data: fallbackData as T,
        error: errorMessage,
        rawResponse: originalResponse,
      };
    }

    return {
      success: false,
      error: errorMessage,
      rawResponse: originalResponse,
    };
  }
}

/**
 * Validates and sanitizes parsed JSON data with field constraints
 */
export function validateAndSanitizeFields<T extends Record<string, any>>(
  data: any,
  fieldConstraints: {
    [K in keyof T]?: {
      maxLength?: number;
      required?: boolean;
      defaultValue?: T[K];
      transform?: (value: any) => T[K];
    };
  }
): T {
  const result = {} as T;

  for (const [field, constraints] of Object.entries(fieldConstraints)) {
    const value = data[field];
    const { maxLength, required, defaultValue, transform } = constraints || {};

    if (value === undefined || value === null) {
      if (required && defaultValue === undefined) {
        throw new Error(`Required field '${field}' is missing`);
      }
      result[field as keyof T] = defaultValue as T[keyof T];
      continue;
    }

    let processedValue = transform ? transform(value) : value;

    if (typeof processedValue === "string" && maxLength) {
      processedValue = processedValue.substring(0, maxLength);
    }

    result[field as keyof T] = processedValue;
  }

  return result;
}
