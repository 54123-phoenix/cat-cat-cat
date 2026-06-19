import base64

# Build the JSX content
lines = []

# Helper
lines.append("import { useState, useEffect } from 'react'")
lines.append("import { useNavigate } from 'react-router-dom'")
lines.append("import { MapPin, MessageSquare, Camera, PawPrint, Cat } from 'lucide-react'")
lines.append("import { getCats, getPosts, getSightings, getUserProfile, getWeeklyReport, recognize, createSighting } from '../api'")
lines.append("import ScanView from '../components/ScanView'")
lines.append("import CatSpinner from '../components/CatSpinner'")
lines.append("")

# Now dump the rest to stdout for piping
print("
".join(lines))