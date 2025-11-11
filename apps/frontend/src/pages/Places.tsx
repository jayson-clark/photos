import { MapPin } from 'lucide-react';

export default function Places() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MapPin className="w-16 h-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Places</h2>
            <p className="text-gray-600 max-w-md">
                This feature is coming soon. You'll be able to view photos organized by location.
            </p>
        </div>
    );
}
