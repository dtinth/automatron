export function decodeRomanNumerals(romanNumerals: string) {
  const decode = (s: string): number => {
    if (s.startsWith('M')) return 1000 + decode(s.substr(1))
    if (s.startsWith('CM')) return 900 + decode(s.substr(2))
    if (s.startsWith('D')) return 500 + decode(s.substr(1))
    if (s.startsWith('CD')) return 400 + decode(s.substr(2))
    if (s.startsWith('C')) return 100 + decode(s.substr(1))
    if (s.startsWith('XC')) return 90 + decode(s.substr(2))
    if (s.startsWith('L')) return 50 + decode(s.substr(1))
    if (s.startsWith('XL')) return 40 + decode(s.substr(2))
    if (s.startsWith('X')) return 10 + decode(s.substr(1))
    if (s.startsWith('IX')) return 9 + decode(s.substr(2))
    if (s.startsWith('V')) return 5 + decode(s.substr(1))
    if (s.startsWith('IV')) return 4 + decode(s.substr(2))
    if (s.startsWith('I')) return 1 + decode(s.substr(1))
    if (s === '') return 0
    throw new InvalidRomanNumeralError(s)
  }
  try {
    return decode(romanNumerals.toUpperCase())
  } catch (e) {
    if (e instanceof InvalidRomanNumeralError) {
      throw new InvalidRomanNumeralError(romanNumerals)
    }
    throw e
  }
}

class InvalidRomanNumeralError extends Error {
  constructor(s: string) {
    super('Invalid roman numeral in input ' + s)
  }
}
