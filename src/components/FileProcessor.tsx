import React, { useState, type FC } from 'react'
import { Box, Text } from 'ink'
import { default as SpinnerIcon } from 'ink-spinner'

type SpinnerName = 'dots' | 'dots2' | 'dots3' | 'dots4' | 'dots5' | 'dots6' | 'dots7' | 'dots8' | 'dots9' | 'dots10' | 'dots11' | 'dots12'

// Create a properly typed Spinner component
const Spinner: FC<{ type?: SpinnerName }> = ({ type = 'dots' }) => {
  return SpinnerIcon({ type }) as any
}

interface FileProcessorProps {
  files: string[]
  onComplete: () => void
}

const FileProcessor: FC<FileProcessorProps> = ({ files, onComplete }) => {
  const [currentFile, setCurrentFile] = useState(0)

  React.useEffect(() => {
    if (currentFile >= files.length) {
      onComplete()
      return
    }
    
    const timer = setTimeout(() => {
      setCurrentFile(prev => prev + 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [currentFile, files.length, onComplete])

  if (currentFile >= files.length) {
    return null
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Spinner type="dots" /> <Text>Processing {files[currentFile]}</Text>
      </Box>
      <Text>
        Progress: {currentFile + 1}/{files.length}
      </Text>
    </Box>
  )
}

export default FileProcessor
