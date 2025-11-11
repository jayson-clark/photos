import { Users } from 'lucide-react';

export default function People() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Users className="w-16 h-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">People</h2>
            <p className="text-gray-600 max-w-md">
                This feature is coming soon. You'll be able to organize photos by the people in
                them.
            </p>
        </div>
    );
}
